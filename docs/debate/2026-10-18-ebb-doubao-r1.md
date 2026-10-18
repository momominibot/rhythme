# Critical review: Ebb cycle chat flows against Ovumind

## 1. Features Ebb has that Ovumind lacks

| Ebb feature, by screen | User value | Clinical-safety risk | Implementation route |
|---|---|---|---|
| Approximate last-period date and certainty, **1a** | Captures uncertain history instead of forcing false precision | An approximate date can still be treated as exact | Deterministic date and certainty fields |
| Goals and free-text symptoms in onboarding, **1b** | Faster, more personal setup; captures cramps and mood | Misses age band, pregnancy state, diagnoses, family history, bleeding history and other existing safety questions | Deterministic slots plus LLM extraction for free text |
| Camera and research consent choices, **1c** | Makes opt-ins visible | Consent is invalid if paired with unsupported HRV, stress or recovery claims | Deterministic toggles; no LLM needed |
| Cycle-aware confirmation header and reply, **2a** | Shows cycle day, phase, prediction and prior cycle length | May declare “Day 1” before confirmation or imply prediction certainty | Deterministic from `cycleStats`; LLM only for phrasing |
| Clarifying question for spotting versus period, **2b** | Prevents an incorrect cycle-start date | Wrong classification changes all downstream cycle metrics | Deterministic buttons and cycle rules; LLM can detect ambiguity |
| Undo, correction and historical backfill, **2b, 2c** | Users can fix mistakes and add past symptoms | Can corrupt stats unless versioned and auditable | Deterministic event-store operations |
| Personal pattern summaries, **2b, 2c, 3a** | Useful recurrence feedback, such as spotting or migraine patterns | Small samples can be overinterpreted | Deterministic aggregation with minimum thresholds |
| Cycle-aware nudges and evening check-in, **3a** | Helps with supplies, symptoms and planned self-care | Notification failure, alert fatigue and incorrect quiet-hour handling | Deterministic scheduler |
| “Why am I anxious?” answer with HRV context, **3b** | Gives a possible explanation and next actions | Can imply causation, diagnosis or validated stress measurement | Deterministic data retrieval plus tightly templated or LLM-generated prose |
| Cycle chart, **3c** | Calendar and trend overview | Visuals can exaggerate weak patterns or predictions | Deterministic rendering |
| Immediate safety alert during logging, **4a** | Converts delayed flags into urgent triage | Threshold, location and emergency-call errors can cause harm | Deterministic rules only; LLM must not suppress or alter the flag |
| One-page doctor report and suggested questions, **4b** | Improves visit preparation | A concise PDF may omit contradictory raw data or appear diagnostic | Deterministic summary; LLM may draft questions for review |
| Chat-based deletion, export and partner sharing, **4c** | Gives users control | Key loss, sync leakage and third-party disclosure risks | Deterministic controls; partner share should be deferred |
| Painkiller/medication logging and reminder, **2a, 2c** | Adds treatment context and may support adherence | Could drift into dosing advice or medication management | Deterministic log and reminder; no recommendations without clinical review |

## 2. What Ovumind already does better and must not lose

- Do not replace the illustrated room and its multiple entry points with a blank chat. Sleep, period, symptoms, USDA food data, yoga, acupressure, reminders, shop and mindfulness are discoverable non-chat pathways.
- Keep the typed local event store, strict JSON parsing and explicit “Here is what I understood” confirmation model.
- Keep deterministic rule agents as the only source of clinical flags. Ebb shows one urgent response, while Ovumind already covers cycle boundaries, prolonged bleeding, clots or disruption, late periods, intermenstrual spotting, postmenopausal bleeding, severe pain, low mood and heavy bleeding with dizziness.
- Keep flags in daily and four-week summaries and the doctor share even if a new immediate alert is added.
- Preserve the broader 17-step onboarding, including the urgent-now 995/KKH screen, pregnancy state, age band, diagnoses, family history, hormones, bleeding signs and explicit unknown states.
- Retain the second-model clinical coverage review of onboarding.
- Preserve Erin Lee’s recorded coaching and the ERIN brand assets. A generic chatbot should not be presented as equivalent to a real coach.
- Keep the full doctor bundle with raw entries, daily summaries, model summary, flags and print output. A one-page summary must supplement, not replace, it.
- Retain the current experimental camera-pulse labeling. Ovumind is currently more honest than Ebb about the limitation of the feature.

## 3. Overclaims and safety problems in Ebb copy

| Screen and issue | Honest replacement wording |
|---|---|
| **1c, 3b:** Claims a camera scan can read “stress and recovery,” help determine cycle phase and provide insight even without logging. Phone camera RMSSD is not a validated diagnostic measure of stress, recovery or cycle phase, especially from a 60-second face scan. | “Experimental camera reading. It may estimate pulse and short-term HRV under good conditions, but it does not diagnose stress, recovery, sleep or cycle phase. Video is processed on your device; only derived readings are stored. Do not use it for medical decisions.” |
| **1c:** “Use my HRV, stress and sleep” incorrectly implies the scan measures sleep. | “Use my experimental pulse and HRV readings in cycle charts.” |
| **3b:** “Lower HRV often goes with feeling more stressed” and “Seen in 3 of 3 cycles” imply a reliable causal pattern. | “Your recent reading was 12% lower than your average follicular-phase reading. This appeared in three recorded cycles, but three cycles are weak evidence. HRV is also affected by sleep, illness, movement, caffeine, alcohol, medication and measurement quality.” |
| **4a:** “Written with clinicians” is vague and can imply endorsement. | “Clinically reviewed safety rule, version and review date shown. This is not a diagnosis.” |
| **4a:** Heavy bleeding threshold is undefined. Pad absorbency varies, and dizziness with heavy bleeding may indicate significant blood loss. | “Heavy bleeding with dizziness can mean significant blood loss. Seek urgent medical assessment now. Call 995 if you feel faint, very weak, short of breath, or your heart is racing. If pregnancy is possible, tell the dispatcher. Soaking a pad or tampon hourly for two or more consecutive hours, passing large clots, or bleeding you cannot control also requires urgent assessment.” |
| **4a:** “Find nearest A&E or clinic” needs reliable Singapore location and operating-hours data. | Use 995 and KKH/urgent-care guidance first; add mapping only after directory validation. |
| **4c:** “Encrypted backup only you can unlock” is false today because Supabase sync exists in schema but is not wired and end-to-end encryption is not available. | “Charts are stored in this browser. Encrypted backup is not currently available. If enabled later, only a key you control will decrypt it; if you lose the key, data may be unrecoverable.” |
| **1a, 4c:** “Everything you tell me stays private to you” and “Only you” do not disclose the model relay used for longer notes. | “Entries are stored locally. Longer free-text notes may be sent to a parsing service to extract structured entries. Sync is disabled unless you turn it on.” |
| **2a, 2b, 3a:** Prediction language such as “Right on time” and narrow windows overstates certainty. | “Estimated start: 31 Oct to 3 Nov, based on your recorded cycles. Accuracy is limited with few cycles, irregularity, hormonal medication, pregnancy, illness or stress. This is not contraception or medical advice.” Show normal, wide or suspended prediction mode. |
| **2a:** “Got it. Day 1 of a new cycle” appears before the user confirms the card. | “Possible Day 1. Confirm the extracted period start to update cycle statistics.” |

## 4. Naming recommendation

Keep the companion name **Luna**.

Luna is already the orb and chat logger in the room, so adding cycle awareness is an extension of an established character rather than a new product. Ebb creates unnecessary fragmentation alongside ERIN, Eve’s Rhythm, Inner Nurture and the real coach Erin Lee. It also resembles a third-party brand and could confuse users about who is providing clinical information. “Ebb cycle chat flows” can remain an internal artifact label, but the user-facing assistant should remain Luna.

## 5. Ranked top 10 changes

| Rank | Change | Size | Acceptance test |
|---|---|---|---|
| 1 | Raise deterministic safety alerts at logging time, starting with heavy bleeding plus dizziness | L | Entering “soaking pad every hour and dizzy” triggers urgent guidance and 995 before any LLM response; the event and flag are saved and also appear in the doctor bundle. Airplane mode does not disable the rule. |
| 2 | Add edit, undo, backfill and an audit trail | L | User changes period end from Wednesday to Tuesday, backfills migraine on Day 2, undoes both actions, and cycle stats, flags and summaries restore correctly. Original and changed timestamps are retained. |
| 3 | Add spotting versus period clarification | M | “Brown discharge” asks Period, Spotting or Not sure. Spotting does not create a new cycle. Period selection asks for date/time/flow and recomputes cycle day. Not sure remains provisional and schedules follow-up. |
| 4 | Show prediction ranges and normal/wide/suspended mode | M | A calendar/chart shows a range only when sufficient local data exists. It suspends or widens for irregular cycles, hormonal medication, perimenopause or missing LMP. Editing an event updates the range. |
| 5 | Correct privacy controls and implement deletion/export | M | “Delete yesterday’s log” removes the event, recomputes stats and records confirmation. Export contains typed entries and HRV. The screen accurately describes local storage, model relay, disabled sync and absent encrypted backup. |
| 6 | Add a one-page clinician summary without removing the full bundle | M | PDF includes six-cycle history, flags, pain, migraine, mood, bleeding, limitations, editable questions and a link to the full raw bundle. It cannot be generated from model prose alone. |
| 7 | Add opt-in cycle-aware nudges | M | A nudge can be scheduled two days before earliest predicted start, with at most one per day, no notification after 10 pm, snooze, cancellation, timezone handling and an explanation screen. Suspended predictions do not nudge. |
| 8 | Replace random post-save sentences with deterministic cycle context and pattern cards | M | After confirmed save, Luna states cycle day, phase, prediction status and a personal pattern only when a defined threshold is met, with basis and sample size. No causal medical claim appears. |
| 9 | Link experimental HRV readings to cycle day, with guarded charting | M | Readings store bpm, RMSSD, quality, duration, method and timestamp; video remains on device; users can delete readings. Stress, recovery and cycle-phase claims are absent, and charts require a minimum number of valid readings. |
| 10 | Use a chat shell for onboarding without losing clinical coverage | L | All existing mandatory fields are collected or explicitly marked unknown. The urgent 995/KKH screen appears before insights. Predictions remain suspended until required data exists, and the second-model clinical review still passes. |

## 6. Reject or defer

- Reject the three-step replacement onboarding and “No forms to fill in” claim.
- Reject camera-derived stress, recovery, sleep or cycle-phase claims pending validation.
- Reject any LLM authority to create, dismiss or downgrade safety flags.
- Reject the “encrypted backup only you can unlock” claim until end-to-end sync, key recovery and loss behavior are implemented and tested.
- Reject replacing the full doctor bundle with a one-page PDF.
- Reject automatic Day 1 assignment before user confirmation.
- Defer partner sharing until granular permissions, revocation and sync security exist.
- Defer research consent until data governance, sync security and an appropriate research review are ready.
- Defer nearest A&E mapping until a validated Singapore clinic/A&E directory is available.
- Defer medication logging and reminders after the core event, safety and prediction work is complete.