1. **Safety and accuracy**

The draft’s limits on strength, bone-density and longevity claims are appropriate. The main problem is that its general precautions do not yet become movement-specific rules.

| Priority / document line | Exact wording | Required replacement or addition |
|---|---|---|
| **P1, L393: emergency response** | “Seek appropriate medical help for severe or persistent symptoms.” | “Stop for pain, dizziness, chest discomfort or unusual breathlessness. Call **995** for severe chest pain, severe breathing difficulty, collapse or stroke signs. Seek medical advice for other persistent or recurring symptoms.” Do not imply someone should wait for an emergency to persist. [SCDF](https://www.scdf.gov.sg/home/about-scdf/emergency-medical-services) |
| **P1, L131/L133: glute bridge and dead bug** | “Stable surface; avoid if position causes pain”; “Keep range comfortable; avoid breath-holding” | Add: “Under Rhythme’s existing pregnancy rule, do not offer lying-flat versions after the first trimester; offer a reviewed upright alternative.” This enforces the app’s chosen rule, rather than claiming a single short bridge is proven harmful. NHS guidance specifically cautions against prolonged supine exercise, particularly after 16 weeks. [NHS](https://www.nhs.uk/best-start-in-life/pregnancy/exercising-in-pregnancy/) |
| **P1, L105/L114/L129/L133: bracing and trunk exercises** | “Continue breathing; avoid straining”; “Keep breathing normally”; “Continue breathing”; “Keep range comfortable; avoid breath-holding” | Add: “Stop if this causes pain, bladder/bowel leakage, vaginal heaviness or abdominal doming; seek pelvic-health advice. After birth, return gradually within your recovery restrictions.” Bracing itself is not universally contraindicated postpartum. [NHS physiotherapy guidance](https://www.gloshospitals.nhs.uk/your-visit/patient-information-leaflets/postnatal-exercises/) |
| **P1, L225: calf symptoms** | “Acute calf/Achilles pain” | Add: “New one-sided calf pain or swelling, especially with warmth or colour change: skip and obtain urgent medical assessment. With chest pain or breathlessness, call 995.” This needs a care action, especially after surgery or childbirth. [NHS DVT guidance](https://www.nhs.uk/conditions/deep-vein-thrombosis-dvt/), [SCDF](https://www.scdf.gov.sg/home/about-scdf/emergency-medical-services) |
| **P1, L398: restrictions** | Groups “may require a reviewed alternative or clinician/exercise-professional guidance.” | “Before activation, define exercise-level eligibility and alternatives for pregnancy/postpartum, pelvic-floor symptoms, fracture history, dizziness/fainting, painful joints and recent surgery. Existing rehabilitation restrictions take precedence.” The groups are already named; the missing element is enforceable behaviour. No universal postoperative waiting period. [NHS recovery guidance](https://www.nhs.uk/tests-and-treatments/having-surgery/recovery/) |
| **P1, L312: schema loses a precaution** | `"safety_flags": [` | Add `"recent_surgery_or_injury_requiring_guidance"`: it appears in P01’s prose at L159 but disappears from its example data. Generate cards and filtering from the same approved record. |
| **P1, L100 and other standing options: dizziness/POTS** | “Only with sufficient space and stable footing” | Add: “If standing brings on dizziness or faintness, do not start this option. Choose a comfortable seated option or skip; follow your existing care plan.” Stable support does not prevent fainting. Apply to standing marches, calf raises, sit-to-stand and walking/stair suggestions. [Johns Hopkins POTS guidance](https://www.hopkinsmedicine.org/health/conditions-and-diseases/postural-orthostatic-tachycardia-syndrome-pots) |
| **P2, L201/L204: hip hinge** | “keeping the spine comfortable”; “Soften your knees and send your hips back” | “Soften your knees, move your hips back and keep your back long rather than rounding it. Return without forcing the range.” Add individual advice for recovering fractures, symptomatic spinal fractures or multiple fragility fractures. Osteoporosis alone does not prohibit hip hinges. [Royal Osteoporosis Society](https://theros.org.uk/information-and-support/exercise/how-to-exercise-safely-for-bones/) |
| **P2, L152/L240/L218: supports** | “Stable chair; hands optional”; “Stable chair”; “Stable support when needed” | Chair: “Firm chair without wheels, on a non-slip floor; feet reach the floor.” Supported calf raise: “Hold a fixed support throughout this version.” [NHS strength exercises](https://www.nhs.uk/live-well/exercise/strength-exercises/) |
| **P2, L91/L92: evidence labels** | “A for general activity; B for this dose”; “A/B” | “General activity guidance supports moving more. This particular duration is not validated.” **B means recognised movement, not evidence for this dose**, according to L70 itself. |
| **P2, L369: cycle personalisation** | “Cycle phase should be a soft context signal” | “Do not select or rank movements by predicted cycle phase. Use the person’s chosen setting, preferences and current reported comfort.” [McNulty 2020](https://link.springer.com/article/10.1007/s40279-020-01319-3) |

The five citations check out with these boundaries:

| Source | What it supports |
|---|---|
| [WHO 2020](https://www.who.int/publications/i/item/9789240015128) | General activity guidance, not validation of PULSE’s individual routines. Publication verified; full guideline retrieval was blocked during this review. |
| [CDC](https://www.cdc.gov/physical-activity-basics/guidelines/adults.html) | Activity can accumulate in smaller chunks; aerobic and all-major-muscle strengthening recommendations remain distinct. |
| [Stamatakis 2022](https://www.nature.com/articles/s41591-022-02100-x) | Observational associations involving **vigorous** lifestyle activity in UK Biobank non-exercisers. It does not establish benefits from gentle seated PULSE movements or prove causation. L73 is appropriately cautious. |
| [Royal Osteoporosis Society](https://theros.org.uk/information-and-support/exercise/exercise-for-bones/) | Appropriately selected impact and progressive resistance exercise for bones, with fracture-specific adaptations. It does not validate these micro-doses as bone-building. |
| [McNulty 2020](https://link.springer.com/article/10.1007/s40279-020-01319-3) | Trivial average performance differences, low-quality evidence and no general phase-based prescription. Participants were healthy, regularly menstruating women aged 18–40, not all Rhythme users. |

I found no clear anatomical error in P01–P06, or grounds to call the modest repetition counts inherently unsafe. L63 already says not to rush. Existing travel, wet-floor and hot-item precautions should remain.

2. **Conflicts with the existing app**

- **Cycle selection:** L369 conflicts directly with `ovu-exercise.js:130`, “Rhythme never plans your training by cycle day,” and **E70**, `ovu-evidence.js:96`. Current context uses logged bleeding/cramps, not predicted phase (`ovu-exercise.js:114`).
- **Pregnancy:** bridge/dead-bug filtering omits the supine restriction already stated in `ovu-exercise.js:131` and **E67**, `ovu-evidence.js:93`.
- **Duration:** the 20-second fallback cannot pass the current integer-minute logger (`ovu-exercise.js:56`, `room.js:2518`). Weekly counting rounds again at `ovu-exercise.js:86`. A 60-second wrapper containing 45 seconds of movement must not become one full movement minute.
- **Counting:** E69 (`ovu-evidence.js:95`) does not justify assigning generic MET values to PULSE. One local exercise must not automatically earn an all-major-muscle strength day (`ovu-exercise.js:75`). Also, setting `aerobic:false` currently categorises its minutes as strength work (`ovu-exercise.js:90`).
- **Rewards and ownership:** retain six exercise-logging hearts daily (`ovu-rewards.js:7`, `:40`). A timed runner must join the existing one-activity rule (`room.js:2192`), also described in `STATUS.md:6`.

E68, E71 and E72 introduce no additional direct contradiction. E71’s period-pain evidence must not become a claim that one PULSE break treats cramps.

3. **Smallest build**

Add **“PULSE · a short movement break” inside the existing Movement sheet**, reached through Mind → Movement (`room.js:2466`). Keep both legacy exercise pages as redirects.

Ship only these three after movement-specific review:

- **P05 seated knee extension:** work/home.
- **P06 seated shoulder-blade squeeze:** work/home/waiting while seated.
- **P02 wall push-up:** work/home, with wrist, shoulder and recovery restrictions.

One level each initially. Defer public-transport standing, bathroom/kitchen prompts and floor exercises.

A compact content record could be:

```js
{
  id: "P02", version: 1, status: "draft",
  name: "Wall push-up",
  settings: ["work", "home"],
  setup: "Fixed wall; clear, dry floor.",
  workSeconds: 45, resetSeconds: 10,
  cue: "Bend your elbows, then press away gently. Keep breathing.",
  safetyRuleIds: ["upper_body_pain", "recovery", "dizziness"],
  evidence: {
    label: "B", doseValidated: false,
    generalRefs: ["E67"],
    techniqueUrl: "https://www.nhs.uk/live-well/exercise/strength-exercises/"
  },
  reviewer: null, reviewedAt: null,
  erinLineId: "pulse-wall-push"
}
```

**Before the first movement**, show:

> **Before you move**  
> For adults 18+. Choose a clear, dry space and stable support.  
> Need an adapted option? Pregnancy/after birth, pelvic symptoms, fracture, recent surgery, painful joints or dizziness/fainting.  
> Stop if you feel pain, dizzy or unwell. You can skip anytime.

Selections must reveal only reviewed compatible options; otherwise offer skip or ordinary movement logging. Keep the 995 emergency action accessible. Repeat the brief surroundings check each session.

**Log only after “Log what I did.”** Reuse the existing `exercise` event with PULSE ID/version, chosen setting, actual active seconds, completed/stopped-early status and optional feeling. Exclude setup/reset; keep MET unknown and strength-day false. Show unclassified PULSE duration separately until intensity is established. Preserve seconds through weekly, journal and summary displays.

Award the existing **six hearts once per day across all movement logging**. Twenty seconds and stopping early earn the same logging reward; repeats, harder options and longer sessions earn nothing extra. Skipping has no penalty.

Give Start, Swap, Skip, Stop and Log short approved Erin lines, with captions and mute support. Start timing only after setup; cancel on exit/hidden state; never infer completion from timer expiry.

Do not build cycle/readiness recommendations, automatic progression, strength/bone scores, functional tests, streak pressure, impact exercises or the proposed 20–30-movement catalogue yet.

4. **Verdict: SHIP-WITH-CHANGES**

Limited to the three-movement build above. Activation requires:

1. **P1:** explicit emergency, pregnancy, recovery, pelvic-floor and dizziness rules, with qualified sign-off per movement.
2. **P1:** one consistent safety record and safe timer/activity ownership.
3. **P2:** accurate seconds, unknown MET handling and the shared daily reward cap.
4. **P2:** remove phase-based ranking and dose-implying evidence labels.
5. **P3:** shorten cards to setup, one cue and Stop; replace “Wherever you are” with “A small movement break, when the setting is safe.”

No files changed.

