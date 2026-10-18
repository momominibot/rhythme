Read-only review completed. No files changed or git write commands run.

References: **C** = [Claude R1](/Users/michiyomimi/Doubao/chats/2026-10-16/new-chat-12/ovumind/docs/debate/2026-10-18-ebb-claude-r1.md); **K** = [Codex R1](/Users/michiyomimi/Doubao/chats/2026-10-16/new-chat-12/ovumind/docs/debate/2026-10-18-ebb-codex-r1.md). Line numbers below refer to those drafts.

**Disagreements and verdicts**

1. **4a urgency**  
   Claude, C58: “Get checked today” is adequate.  
   Codex, K47: Hourly soaking with dizziness warrants emergency assessment now.  
   **Verdict:** Use “emergency department now.” KKH explicitly directs heavy vaginal bleeding to immediate assessment; SCDF lists excessive bleeding among emergencies. The generic NHS heavy-period page does not substantiate C58’s specific triage conclusion. [KKH](https://www.kkh.com.sg/our-specialties/urgent-og-centre), [SCDF](https://www.scdf.gov.sg/home/about-scdf/emergency-medical-services)

2. **HRV chart and interpretation**  
   Claude, C47/76: Ship phase comparisons with honest labels and minimum reading counts.  
   Codex, K43: Defer biometric overlays pending validation.  
   **Verdict:** Defer phase-labelled HRV comparisons in this build. Three readings per phase across three cycles is an unvalidated threshold. Raw experimental readings by date can follow measurement repairs and quality checks. My requirement for hormone-referenced validation was excessive for a descriptive plot; it remains appropriate for claiming biological phase detection. Another app’s validation does not validate Ovumind. [CameraHRV study](https://www.frontiersin.org/journals/physiology/articles/10.3389/fphys.2025.1707318/full)

3. **Default-on model versus opt-in**  
   Claude: R1 retains the relay and proposes disclosure, but never explicitly argues for default-on Luna.  
   Codex, K69: Require purpose-specific permission before transmission.  
   **Verdict:** Default off; offer separate note-parsing and summary permissions during onboarding, with first-use confirmation. Scan and research choices are separate. Apple requires explicit permission for third-party AI sharing in App Store apps, although it does not prescribe onboarding placement. [Apple §5.1.2(i)](https://developer.apple.com/app-store/review/guidelines/#data-use-and-sharing)

4. **Implementation order**  
   Claude, C85–95: After spotting and alerts, prioritize context, Undo and nudges.  
   Codex, K67–76: Repair integrity, safety, consent and deletion first.  
   **Verdict:** Foundation first. Same-day replacement makes delete-based Undo destructive; question mode depends on trustworthy aggregation. Context can follow promptly once those dependencies pass.

5. **“Why am I anxious?”**  
   Claude, C46: Answer using cycle context, personal recurrence and education.  
   Codex, K45: Describe observations without explaining anxiety through hormones or HRV.  
   **Verdict:** Adopt question mode as “what your log shows.” Say explicitly that the log cannot establish the cause. Route urgent questions through safety rules first. The cited study found typical luteal HRV decreases were not associated with premenstrual emotional changes. [Original study](https://link.springer.com/article/10.1186/s12905-024-03273-y)

6. **Corrections, model necessity and Undo**  
   Claude, C29/35/88: Match by type/date, use the model for free wording, delete saved IDs for Undo.  
   Codex, K71: Resolve exact records deterministically and restore previous values.  
   **Verdict:** Exact-ID operations with before-images. `add()` can update an existing record, so deleting its returned ID destroys earlier data. “Day 2” also needs an identified cycle, not automatically the latest one. Models may propose intent; they are optional. [Store implementation](/Users/michiyomimi/Doubao/chats/2026-10-16/new-chat-12/ovumind/ovu-store.js:81)

7. **Saving during an urgent alert**  
   Claude, C57/86: Show the alert and “still save the entries.”  
   Codex, K30: Preserve confirmation.  
   **Verdict:** Guidance appears immediately, independently of extraction or saving. Saving remains explicit. Do not claim “I’ve logged” before success.

8. **Research controls**  
   Claude, C68: Show an off-by-default toggle now, wire it later.  
   Codex, K78: Defer contribution until processing and controls exist.  
   **Verdict:** Defer the actionable toggle. An unwired switch cannot represent effective consent.

9. **Forecasts and sample thresholds**  
   Claude, C17/22/30: Widen ranges for uncertainty; speak about patterns after three completed cycles.  
   Codex, K45/72–73: Preserve uncertainty, eligibility and missingness.  
   **Verdict:** Distinguish observed historical range from a calibrated prediction interval. Three cycles is a product guardrail, not scientific sufficiency. Sparse observations may be reported descriptively. `wide` currently changes neither forecast arithmetic nor phase estimation. [cycleStats](/Users/michiyomimi/Doubao/chats/2026-10-16/new-chat-12/ovumind/ovu-store.js:148)

10. **Chapters and `certainty`**  
    Claude, C17: Three chapters and exact/approximate/unsure dates.  
    Codex, K11/28: Preserve uncertainty and allow staged intake.  
    **Verdict:** Agreement, not opposition. Adopt the concrete chapters with truthful question progress. `certainty` must survive edits, imports and reports.

11. **Names and tagline**  
    Claude, C81: Possibly expose “Luna, in Ebb mode”; no tagline position appears in R1.  
    Codex, K59: Keep Ebb internal and replace “mindfully aged” with “mindfully.”  
    **Verdict:** Keep Ebb internal for now. I withdraw automatic tagline replacement: your clinical collaborator supplied it, and healthy ageing may be intentional positioning. Neither review establishes which wording performs better.

**Factual errors and overclaims in Claude’s draft**

- **C56, “only when summaries run”: false.** `afterSave()` immediately runs analysis and displays a high-flag toast. The gap is late, weak presentation. [room.js:1321](/Users/michiyomimi/Doubao/chats/2026-10-16/new-chat-12/ovumind/room.js:1321)
- **C67, “onboarding privacy step is honest”: false.** “Nothing is uploaded” conflicts with default-on AI and automatic journal summaries.
- **C68, “note only”: incomplete.** Insights transmit health-profile context and recent entries or aggregates. “Nothing is sold, no ads” is unverified; existing deletion controls omit stores. [ovu-insight.js:24](/Users/michiyomimi/Doubao/chats/2026-10-16/new-chat-12/ovumind/ovu-insight.js:24)
- **C27, “brown discharge gets saved as a period day”: overgeneralized.** That exact phrase does not match the local period branch. The proven defect is stored spotting entering `periodEpisodes()`.
- **C73, “gives a noisy RMSSD”: understates a defect.** Face capture supplies `timestamp`; the processor expects `time`. I reproduced 72 bpm with `time`, versus invalid BPM/HRV with `timestamp`. Its arbitrary calm score also contradicts the claimed caution. [face input](/Users/michiyomimi/Doubao/chats/2026-10-16/new-chat-12/ovumind/face-ppg.html:112), [processor contract](/Users/michiyomimi/Doubao/chats/2026-10-16/new-chat-12/ovumind/ppg.js:158)
- **C75:** Client-side encryption alone does not establish exclusive user access; key custody and recovery matter.
- **C63:** Existing `.ics` exports recurring reminders, not dated appointments.
- **C7:** “Every interaction” has a save card and “every screen” a cycle header overstates the supplied transcript.
- **C57:** Postmenopausal spotting needs assessment, but should not automatically receive the same emergency wording as heavy bleeding with dizziness. [NHS](https://www.nhs.uk/symptoms/post-menopausal-bleeding/)

**Concessions**

Claude’s chapter structure, separate question route, explicit negative check-in and contextual replies make the interaction proposal more concrete than mine. Versioned camera-reading storage is reasonable independently of clinical interpretation. My review under-ranked that conversational value and overreached on the tagline and descriptive-chart validation requirement.

**Merged implementation order**

D = deterministic; M = model. Tags describe review agreement, not clinical validation. Preserve the room and mindfulness focus.

| ID | Screens | Target file/function | Mode; size | Acceptance test | Tag |
|---|---|---|---|---|---|
| 01 | 4a | `room.send/openUrgentCard`; `orb.parseLocal` | D; M | Exact emergency sentence alerts offline before parsing/saving; creates no lunch entry. | **CONTESTED:** emergency now versus today |
| 02 | 1b, 4a | `room.finishOnboarding`; `agents.cycleAgent` | D; M | Existing `post` profiles normalize; postmenopausal spotting also flags, with appropriate urgency. | **CONSENSUS** |
| 03 | 2a–b, 4a | `store.add/update` | D; M | Adding anxiety preserves earlier dizziness, pain and cramps; safety evidence survives. | **CONSENSUS** |
| 04 | 2b, 3c | `store.periodEpisodes`; `room.send` | D; M | Spotting never starts a cycle; “not sure” remains unresolved; historical records remain recoverable. | **CONSENSUS** |
| 05 | 1c, 4c | `ONB`; `orb.aiConfig`; `insight.enabled/plan` | D; M | Fresh install transmits nothing before purpose-specific permission; revocation blocks future calls. | **CONTESTED:** default-on disclosure is insufficient |
| 06 | 4c | `privacy-local.inventory`; `store.clearAll`; journal controls | D; M | Export/delete covers documented stores and mirrors, preserves unrelated data, reports failures. | **CONSENSUS** |
| 07 | 1a, 2c, 4c | `confirmCard`; `store.update/remove` | D, optional M intent; L | Ambiguous targets require clarification; Undo restores existing records and derived results. | **CONTESTED:** exact IDs and restoration required |
| 08 | 1a, 2a, 3c | `orb.dateFrom`; `store.cycleStats`; `renderCal` | D; M | Relative dates resolve correctly; uncertainty persists; suspended forecasts disappear; unsupported phases absent. | **CONSENSUS** |
| 09 | 2a–c, 3a | `store.TYPES`; `orb.parseLocal/save`; `agents.SYMPTOMS` | D; M | Poor sleep needs no invented times; migraine stays distinct; medication remains reported; check-in differs from silence. | **CONSENSUS** |
| 10 | 2b–c, 3b | new `agents.cyclePatterns`; `insight.dailyInput` | D; M | Counts match fixtures; supporting dates, eligible denominator and missingness appear. | **CONSENSUS** |
| 11 | 1a–c, 2a, 3b | `ONB`; `room.openLuna/confirmCard` | D, optional M prose; M | Three chapters retain intake coverage; context uses valid estimates; question answers assert no cause. | **CONTESTED:** question mode must remain descriptive |
| 12 | 4b | `fourWeekSummary/buildBundle`; doctor rendering; appointment exporter | D, optional M prose; M | Selected coverage reconciles; editable questions survive encryption; appointment exports once. | **CONSENSUS** |
| 13 | 3a | `remind.due/ics`; reminder editor | D; M | Opt-in, snooze, quiet hours and daily cap persist; closed-app limitations disclosed. | **CONSENSUS** |
| 14 | 1c, 3b–c | `face.finish`; `ppg.process`; reading schema | D; L | Correct timestamps; reject nonfinite/noisy results; remove calm score; verify network behaviour. | **CONTESTED:** raw experimental readings first; phase overlays deferred |

**Exact copy**

**4a urgent card**

- **Title:** Get emergency care now
- **Body:** Soaking through a pad every hour and feeling dizzy needs medical assessment now. Go to the nearest emergency department. Do not wait to finish logging.
- **Escalation:** Call 995 now if bleeding is excessive or will not stop, you faint, have trouble breathing, or have chest pain.
- **Actions:** Call 995 · Find nearest emergency department · Show my chart
- **Disclaimer:** Ovumind cannot assess your condition or diagnose. This alert uses published guidance. No clinician receives this alert.

**Camera offer**

Until item 14 passes: **“Camera checks are unavailable in this build.”**

Afterward:

> **Try an experimental camera check?**  
> A short scan estimates your pulse and pulse variability. Ovumind’s readings have not been clinically validated. They cannot determine cycle phase, confirm ovulation, or measure stress or recovery. Keep a reading only if you choose.  
> **Try camera check · Skip for now**

**“Who can see my data?” for the current build**

> Your saved records live in this browser without app-level encryption. Someone with access to this browser profile may read them.
>
> Luna’s online model is currently on by default. Notes, and automatic journal-summary inputs containing recent entries and health context, can pass through Supabase to Doubao on Volcengine Ark. Other configured providers may receive requests too. Turn AI off in Luna’s settings to stop future AI requests.
>
> No clinician monitors your records or receives alerts. Anyone given your encrypted share and passphrase can read it. Ordinary JSON backups are unencrypted; cloud backup is not connected.
>
> Current deletion controls are incomplete. They cannot recall downloaded copies or data already sent. Provider retention and no-sale guarantees have not been verified.

