# Codex check of the three PULSE cards as shipped, 22 October 2026 (round 1: HOLD)

1. **Not every requirement landed.** Setup, cues, easier versions, skip lines, BEFORE, signing, no phase selection, unknown intensity/MET and no strength day are present (`ovu-pulse.js:13–50`). Six hearts remain shared once daily (`ovu-rewards.js:7,51–62`); Stop/Skip costs nothing. Missing: the local 18+ reminder, compatible-option screening, Swap and Skip voice support (`room.js:2525–2540`). Seconds disappear downstream: journal shows **0 min** (`journal.html:152,271`), and summaries omit PULSE seconds (`ovu-agents.js:251`).

2. **Safety wording needs completion** (`ovu-pulse.js:17–40`):
   - Specify non-slip seating, including P06. [NHS setup guidance](https://www.nhs.uk/live-well/exercise/strength-exercises/).
   - Explain pelvic symptoms: leakage, vaginal heaviness or abdominal doming; stop and seek advice. [NHS physiotherapy guidance](https://www.gloshospitals.nhs.uk/your-visit/patient-information-leaflets/postnatal-exercises/).
   - Include existing rehabilitation restrictions and spinal/multiple-fracture history, beyond “recent fracture.” Osteoporosis alone is not a blanket contraindication. [Royal Osteoporosis Society](https://theros.org.uk/information-and-support/exercise/how-to-exercise-safely-for-bones/).
   - Frame pregnancy/postpartum skipping as this feature’s limitation, rather than suggesting all gentle exercise is unsafe. [Pregnancy](https://www.nhs.uk/pregnancy/keeping-well/exercise/), [postpartum guidance](https://www.nhs.uk/baby/support-and-services/keeping-fit-and-healthy-with-a-baby/).
   - Retain joint-pain/dizziness skips; add chest pressure/tightness, unusual breathlessness and persistent-symptom advice. “Local emergency number” is appropriate. [NHS chest guidance](https://www.nhs.uk/symptoms/chest-pain/).

3. **UI:** Signed cards have no Draft label; saving requires “Log what I did” (`room.js:2515,2568–2570`). Normal setup/rest are excluded. However, I reproduced **2 seconds moving + 60 seconds backgrounded → 45 seconds recorded as completed**: visibility is checked only during timer callbacks (`room.js:2544–2558`). PULSE also lacks shared activity ownership (`room.js:2192–2197`). Emergency guidance disappears after Ready (`room.js:2537`); Stop disappears during rest (`room.js:2547`). “1 min” describes 55 timed seconds (`room.js:2515`).

4. **HOLD: fix background timing, activity ownership, downstream seconds and the missing safety/screening requirements before release.** No files modified.

