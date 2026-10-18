# Ebb to Ovumind: agreed mapping after the multi-model debate (2026-10-18)

**Input:** Dr Patrick's 12-screen chat-first design "Ebb cycle chat flows" (copy in `docs/dr-patrick-ebb-chat-flows-2026-10-18.md`).
**Process:** four blind reviews (Claude, Codex gpt-6.1, DeepSeek V4 flash, Doubao Seed 2.1 pro), a Codex arbitration round against Claude's draft, jev 1.13.0 scoring of the seven contested calls, and a Node harness that reproduces the defects the reviews found. Everything is in `docs/debate/` and `tools/test-core.js`.
**Status:** mapping agreed; nothing below is implemented yet except the test harness. Phase 0 starts next.

## 1. The verdict in one paragraph

Borrow Ebb's interaction patterns, keep Ovumind's room, intake and safety architecture, and do not import Ebb's clinical and privacy promises unchanged. All four reviewers keep the companion's name as **Luna** and keep the 17-step ovarian-health intake. Before any new conversational feature ships, five confirmed defects and one consent mismatch get fixed (jev 0.87 for fix-first). The red-flag card says **emergency care now**, not "doctor today" (jev 0.99). Luna's model becomes **opt-in with purpose-specific permission** collected in the last onboarding chapter (jev 0.97). Camera readings may sit beside the cycle day as experimental values, with no phase averages and no link to anxiety (jev 0.88). Research contribution is a separate informed consent offered only when the back end exists (jev 0.79).

## 2. Defects confirmed by two reviewers and reproduced by `tools/test-core.js`

Run `node tools/test-core.js` (10 failing checks, 1 passing, as of this commit).

| # | Defect | Where | Why it matters |
|---|---|---|---|
| D1 | A spotting entry counts as a period day, so spotting three or more days after a bleed starts a new cycle episode | `ovu-store.js` `periodEpisodes()` filters `flow !== 'none'` | Day 1, cycle length, phase, prediction and the cycle flags all shift |
| D2 | Symptoms are single-per-day and `add()` replaces the data, so a second Luna symptom log the same day erases the first (including pain and dizziness) | `ovu-store.js` `add()` with `SINGLE_PER_DAY` | Loses safety evidence (heavy flow plus dizziness) and any Undo built on delete becomes destructive |
| D3 | The Ebb 4a emergency sentence ("soaking through a pad every hour since lunch, feeling a bit dizzy") matches the meal rule and becomes a lunch entry; no period or symptom entry is produced | `ovu-orb.js` `parseLocal()` meal branch | The one message that must trigger safety guidance produces a food entry |
| D4 | Onboarding writes `lifeStage: 'post'`; the postmenopausal-bleeding rule checks `'postmenopause'`, so that high flag never fires | `room.js` `finishOnboarding`, `ovu-agents.js` `cycleAgent` | A high-priority clinical flag is silently disabled |
| D5 | `predictionMode: 'wide'` changes wording only; the prediction is still a single date from the average and phase estimation falls back to 28 days | `ovu-store.js` `cycleStats()` | "Wide" users get the same false precision as "normal" |
| D6 | Onboarding says "nothing is uploaded" while Luna's model relay is on by default and journal readings auto-run | `room.js` `ONB[0]`, `ovu-orb.js` `defaults()`, `ovu-insight.js` `plan()` | Consent copy is untrue for the default install |
| D7 | The face scan passes `{value, timestamp}` while `Processor.process()` reads `d.time`, so every timestamp is undefined and BPM and HRV are invalid (found by Codex r2, confirmed by reading `ppg.js` line 17); Ovumind's "calm index" formula is unsourced | `face-ppg.html`, `ppg.js` | To be added to the harness before item 17 below |

Also corrected from Claude's draft: `afterSave()` in `room.js` already shows a high-flag toast at save time, so the 4a gap is weak presentation (a toast after the confirm card), not a missing check.

## 3. Screen by screen

| Ebb screen | What Ovumind has | What we take | What we do not take |
|---|---|---|---|
| 1a Welcome, last period with certainty | 17-step chip intake, `lastPeriodStart` date | `certainty` (exact / approximate / unsure) stored on the intake answer and on period-start events; approximate anchors widen the window; free text accepted and parsed | "No forms to fill in" |
| 1b Goals and contraception | goals, hormones, plus age, pregnancy, diagnoses, family, signals | Three chapters (About you, Your cycle, Your choices) with "1 of 3" progress; "change any of this later by telling me" via a profile-update intent | Dropping any intake field |
| 1c Scan and consent | face-ppg and ppg betas, no consent step | Final chapter asks two separate permissions: Luna's model may read longer notes; the insight agent may write readings. Scan offered only after D7 is fixed, with honest wording. | Research checkbox in onboarding; "see where you are in your cycle" |
| 2a Quick log with context | confirm card, random reply, `cycleStats` | Deterministic context after a confirmed save: cycle day, phase, inside or outside the observed window, last cycle length against the observed range; follow-up chips; quality-only sleep | "Got it. Day 1" before confirmation; invented times ("about 7:00") |
| 2b Clarifying question | none; spotting treated as flow | One question for spotting versus period with "Not sure" left unresolved; Undo on the save line; pattern note only with supporting dates and the eligible denominator | Silent classification |
| 2c Correction and backfill | calendar backdating only | Exact-ID update and delete with before-images and Undo; "day 2" resolved against a named cycle; `migraine` symptom; medication logged as reported | Model authority over dates; dosing hints |
| 3a Nudge and evening check-in | fixed-time reminders, .ics | Opt-in cycle heads-up N days before the earliest observed start, one per day, none after 22:00, snooze, "Why am I seeing this"; evening check-in whose "All good" writes a `checkin` event, distinct from silence; suspended mode never nudges | Nudges presented as predictions |
| 3b Ask why, with HRV | insight agents; readings in localStorage | Luna question mode as "what your log shows": cycle day, phase, recurrence with dates and denominator, one vetted education line, "this cannot tell the cause", chips (breathing, add a doctor question, more) | HRV dip explaining anxiety (Schmalenberger 2024 found the luteal HRV decrease was not associated with premenstrual emotional change) |
| 3c Chart view | journal trends, calendar | Last-6 cycle-length strip with the observed range; predicted window band; experimental readings on their day | Body signals by phase |
| 4a Red-flag alert | HEAVY_DIZZY and POSTMENO_BLEED flags, toast at save, urgent card in onboarding only | Inline urgent card before parsing or saving when the raw text or entries match the high rules; copy in section 5; save stays explicit | "Written with clinicians" until signed; A&E map search until a validated directory exists |
| 4b Doctor report | encrypted share with flags, questions, prose, dailies, raw; print | Compact six-cycle summary block on top of the existing bundle; editable questions preserved through encryption; appointment .ics | Replacing the full bundle with a one-pager |
| 4c Privacy | legacy privacy page, partial export and delete | Truthful "who can see my data" answer in Luna; export and delete that cover every store; "forget yesterday's log" with confirmation | "Encrypted backup only you can unlock"; "keep chat history" (chat is not stored); partner sharing |

## 4. Ordered implementation list

D = deterministic, M = model optional. Tags record reviewer agreement, not clinical validation.

| ID | Phase | Item | Target | Mode, size | Acceptance test | Tag |
|---|---|---|---|---|---|---|
| 01 | 0 | Spotting never starts a cycle; spotting is kept as its own observation | `store.periodEpisodes`, `store.add`, `orb.save` | D, M | Harness D1 passes; history stays recoverable | CONSENSUS |
| 02 | 0 | Same-day symptom logs merge (union of symptoms, keep pain and mood unless restated) | `store.add/update`, `orb.save` | D, S | Harness D2 passes | CONSENSUS |
| 03 | 0 | Meal rule yields to safety and period words; emergency sentence parses to heavy flow plus dizziness | `orb.parseLocal` | D, S | Harness D3 passes; the five shortcut chips still parse | CONSENSUS |
| 04 | 0 | Normalise `lifeStage` (`post` and `postmenopause` both work); postmenopausal spotting flags with "see a clinician promptly", not the emergency card | `room.finishOnboarding`, `agents.cycleAgent`, `store.profile` | D, S | Harness D4 passes | CONSENSUS |
| 05 | 0 | Observed window instead of a single date: `predictedFrom/To` from the last six lengths; `wide` adds margin; `suspended` has no phase | `store.cycleStats`, deck, journal, Luna | D, M | Harness D5 passes; no 28-day fallback phase | CONSENSUS |
| 06 | 0 | Model off by default; two purpose-specific permissions in the last onboarding chapter and in Luna's settings; revoking stops insights; copy fixed | `ONB`, `orb.aiConfig`, `insight.enabled/plan` | D, M | Fresh install sends nothing before permission; turning off stops auto readings | CONTESTED (Claude r1 kept default-on; resolved by jev 0.97) |
| 07 | 0 | Inline urgent card at log time, before parsing, with the copy in section 5 | `room.openLuna/send`, `openUrgentCard`, `agents` | D, M | Emergency sentence shows the card offline; save remains explicit | CONTESTED on wording (resolved: emergency now, jev 0.99) |
| 08 | 1 | Export and delete cover every store (events, profile, reminders, readings, insight cache, mirrors); "forget yesterday's log" | `privacy-local.js`, `store.clearAll`, Luna rules | D, M | Inventory lists every documented key; deletion verified by readback | CONSENSUS |
| 09 | 1 | Undo and corrections by exact id with before-images; "actually ... ended on Tuesday"; "day 2" needs a named cycle | `confirmCard`, `store.update/remove`, `orb` | D plus optional M intent, L | Undo restores the original record and derived stats | CONTESTED on mechanism (resolved: exact ids, never delete-by-returned-id) |
| 10 | 1 | Context line after a confirmed save, follow-up chips, quality-only sleep, `migraine`, medication as reported, `checkin` type | `openLuna`, `orb.parseLocal/save`, `store.TYPES`, `agents.SYMPTOMS` | D, M | Context uses the observed window; nothing said under suspended; "All good" differs from no entry | CONSENSUS |
| 11 | 1 | `agents.cyclePatterns`: recurrence of a symptom in a cycle-day window across completed cycles, with dates, eligible denominator and missingness | new in `ovu-agents.js`, fed to `insight.dailyInput` | D, M | Counts match fixtures; silent below the guardrail of three eligible cycles | CONSENSUS |
| 12 | 1 | Clarifying question for spotting versus period, "Not sure" left provisional | `room.send` | D, S | Harness case; "brown discharge" never creates a period day without a choice | CONSENSUS |
| 13 | 2 | Opt-in cycle heads-up and evening check-in with policy (one a day, none after 22:00, snooze, why) | `ovu-remind.js` new kinds, `due/ics` | D, M | Policy survives reload and clock changes; closed-app limits disclosed | CONSENSUS |
| 14 | 2 | Onboarding chapters, `certainty`, truthful progress, profile updates by chat | `ONB`, `openOnboarding`, `finishOnboarding` | D, M | All 17 fields still collected or marked unknown; certainty survives edits and reports | CONSENSUS |
| 15 | 2 | Luna question mode, descriptive only, safety rules first | `openLuna`, `cyclePatterns` | D plus optional M prose, M | Answers carry no cause claim; urgent phrasing routes to the card | CONTESTED (jev 0.70 safe as specified) |
| 16 | 2 | Six-cycle summary block, editable questions through encryption, appointment .ics | `agents.fourWeekSummary`, `journal buildBundle`, `doctor.html`, `remind.ics` | D, M | Coverage reconciles with the selected range | CONSENSUS |
| 17 | 3 | Pulse readings: fix the `time` field, reject nonfinite or noisy results, drop the calm score, store versioned readings in the event store, show on their day | `face-ppg.html`, `ppg.js`, `store` | D, L | Harness D7 passes; no phase or stress wording anywhere | CONTESTED on scope (resolved: readings only, jev 0.88) |
| 18 | 3 | Cycle-length strip and window band in the chart | `renderCal`, journal | D, S | Matches `cycleStats` | CONSENSUS |

## 5. Copy to ship

**4a urgent card** (shown before parsing when the text matches heavy flow with dizziness or faintness, hourly soaking, bleeding that will not stop, sudden severe pelvic pain, bleeding in pregnancy):

- Title: Get emergency care now
- Body: Soaking through a pad every hour and feeling dizzy needs medical assessment now. Go to the nearest emergency department, or KK Women's and Children's Hospital's 24-hour Urgent O&G Centre. Do not wait to finish logging. If pregnancy is possible, say so when you arrive.
- Escalation: Call 995 now if the bleeding is excessive or will not stop, you faint, have trouble breathing, or have chest pain.
- Actions: Call 995 · Nearest emergency department · Show my chart
- Disclaimer: Ovumind cannot assess your condition or diagnose. This alert follows published guidance (KKH, SCDF, NHS). No clinician receives this alert.

Postmenopausal bleeding uses a separate card: "Any bleeding after menopause should be checked by a clinician promptly. Book a GP or gynaecologist visit this week; it is usually not serious, but it needs a check."

**Camera offer** (only after item 17): "Try an experimental camera check? A short scan estimates your pulse and pulse variability. Ovumind's readings are not clinically validated. They cannot tell your cycle phase, confirm ovulation, or measure stress or recovery. Keep a reading only if you choose."

**Who can see my data (this build, until items 06 and 08 land):** "Your records live in this browser, without app-level encryption; someone with access to this browser profile could read them. Luna's model is on by default: longer notes, and the inputs for journal readings, pass through Ovumind's relay to a Doubao model. Turn it off in Luna's settings to stop that. No clinician sees your records or receives alerts. Anyone with your encrypted share and its passphrase can read that share. Plain JSON backups are not encrypted, and cloud backup is not connected. Deleting here cannot recall copies you downloaded or data already sent."

**Context line after a period start** (item 10): "Day 1. That is inside the 31 Oct to 3 Nov window from your last six cycles. The cycle that just ended was 27 days; your observed range is 27 to 30." Under `wide`: "inside the wider window I use because your cycles vary." Under `suspended`: no window sentence.

**Nudge policy line** (item 13): "You asked for a heads-up 2 days before the earliest start in your observed window. At most one nudge a day, never after 10 pm. Say 'change my nudges' any time."

## 6. Decisions that stay with Jamie and Dr Patrick

1. **Name.** All reviewers keep Luna; jev was split between Luna only (0.56) and Luna with Ebb as the chat mode's name (0.44). Default: Luna only, "Ebb" stays an internal label for this feature set.
2. **Tagline.** "Her body, her rhythm, mindfully aged." stays as supplied. Codex withdrew its suggestion to drop "aged".
3. **Clinician sign-off.** The 4a copy and thresholds above need Dr Patrick's named review with a version and date before the app may say "clinically reviewed".
4. **Research consent.** Separate informed consent screen, offered from the privacy card only once sync, access, revocation and de-identification exist.
5. **Sync promise.** "Only you can unlock" requires client-side encryption with key custody and recovery designed; otherwise the copy says "backed up to your account".
6. **Medication logging.** Doubao suggested deferring it; this plan records medication as reported (item 10) and never offers dosing.

## 7. Rejected or deferred

Rejected: replacing the intake with three questions; "No forms to fill in"; cycle-phase, stress, recovery or sleep claims from the camera; HRV as the explanation for anxiety; any model authority over dates, counts, flags or deletions; Day 1 declared before confirmation; a one-page PDF replacing the full bundle; "keep chat history" (chat is not a record).
Deferred: partner sharing; research contribution; exclusive-key cloud backup; A&E map search until a validated Singapore directory exists; body signals by phase.

## 8. Ideas extracted from another team's build (theme and concept unchanged)

Jamie shared nine screens of a pixel-art cottage build by another team on 2026-10-18 (not ours; kept only as reference, not copied as art). Ovumind keeps its Seedream dream room, Luna and Erin. Ideas worth taking, each tied to an item above:

| Reference screen | Idea | Lands in |
|---|---|---|
| Period sheet: Entry = Started / Bleeding / Ended / Spotting, Flow, optional symptoms, date stepper | Make the kind of period event explicit instead of inferring it from flow. "Spotting" and "Ended" as their own kinds solve D1 cleanly and give 2b its chips. Date stepper for backfill. | 01, 12, 09 |
| Sleep sheet: bedtime yesterday, wake time today, live "Time in bed 8h 30m", Restfulness Rested / Okay / Tired | Show time in bed as the user sets the times; a three-word restfulness scale maps onto quality 1 to 5 (Tired 2, Okay 3, Rested 4) and gives Luna a quality-only sleep entry | 10 |
| Furniture bar: Place · Move · Close · Undo | Undo in arrange mode; same Undo affordance Luna gets after a save | 09 |
| Erin sits in the scene per practice: chair by the bed (body scan), table (mindful tea), garden path (grounding), studio cushions (breathe) | Place Erin's sprite at the object a practice belongs to instead of only the projection HUD; each everyday practice already has a room object (coffee at the table, stretch on the mat) | everyday practices, garden and activity-hall homes |
| Two practice formats: timed bar (00:45 / 03:00, Pause, End) and stepped senses (SENSE 1 / 3, Next, Skip, Finish) | Model each guide step as timed or stepped; sensory practices (tea, dishes, shower) use Next and Skip rather than a timer | `ovu-mindful.js` step schema |
| Grounding in the garden: "Notice three things you can see", a glowing ring on the path | First outdoor practice for the garden home; glowing ring plus dotted path as the walk target in `walkTo` | garden home, room polish |
| Journal menu: Period, Sleep, Food, Mood, Symptoms, Water, Movement, Mindfulness, and one "Chat & Log" entry | Water and Movement have no entry types in Ovumind yet (water is only a reminder); Mood sits inside symptoms. Add `water` and `movement` entry types with Luna rules ("drank 2 glasses", "walked 20 min") and count them in the check-in | 10 |
| XP leaf counter and a settings gear pinned to the corners | Our hearts chip already does this; keep one counter, no second currency | none |

Not taken: pixel-art style, the cottage layout, a separate XP currency, the kitchen as a logging surface.

## 9. Sources opened during the debate

KKH Urgent O&G Centre (24-hour, heavy vaginal bleeding for immediate assessment); SCDF emergency medical services (excessive bleeding, fainting, breathlessness are 995 cases); NHS heavy periods and post-menopausal bleeding pages; Schmalenberger et al. 2024, BMC Women's Health (luteal HRV decrease not associated with premenstrual emotional change); Frontiers in Physiology 2025 camera HRV validation (device- and protocol-specific); Apple App Review 5.1.2(i) (explicit permission before sharing personal data with third-party AI).
