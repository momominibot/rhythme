# Learn videos for the desktop: what to make, and how (Gold Drop, 21 October 2026)

Jamie asked for a Gold Drop plan, discussed with Codex, for the short educational films in Rhythme's Learn desk, regenerated to fit a computer screen and stream well, with every clinical claim checked against current evidence. This is research and a plan only. No video, image or voice was generated, no credits were spent, and the app is unchanged. Production needs Jamie's approval. Updated the same night after Jamie chose Seedance for the visuals.

## The answer in brief

- **Retire all six current films.** They are square phone clips of 18 to 28 seconds, carry the old OVARIA brand, and five of them say something we should not repeat: the fertile-window film says the app "pinpoints your unique window" (and spells the brand "Overia" on screen), the hormones film says oestrogen lifts "energy, mood and skin", the menopause film gives age 51 when Singapore's 2026 guideline says 49, the cycle film uses 21 to 35 days and 2 to 7 days where FIGO uses 24 to 38 and up to 8, and the perimenopause film promises women will "thrive" and gives a fixed 4 to 8 years. The first-period film no longer fits an 18+ app.
- **Make 27 short films (60 to 120 s) in three waves**, landscape 16:9 at 1080p, with WebVTT captions and a transcript with sources. Wave 1 (7 films) covers the launch: when to get care now, a typical adult cycle, heavy periods, period pain and endometriosis, the fertile window, perimenopause, and what the app can and cannot tell you.
- **Every clinical film ends with a red-flag line and a see-a-doctor line**, naming the symptoms and the action, with Singapore numbers (995, SOS 1767, mindline 1771) and, for early pregnancy, after-birth and gynaecological emergencies, KKH's 24-hour urgent care centre.
- **Visuals with Seedance (Jamie's choice):** Seedance 2.0 at 1080p 16:9 draws mood and place from watercolour keyframes; every word, number and diagram is drawn in code so it matches the reviewed script. At list prices that is about US$0.37 (2.48 yuan) a second: about US$25 for the A1 pilot, US$170 for wave 1 and US$640 for all 27 films, with spare for retakes. The Volcengine account's terms grant use only in mainland China and need written permission for commercial use, so the same models on BytePlus ModelArk (ByteDance's international platform, available in Singapore) are recommended.
- **Decisions before production:** which Seedance account, and the pilot spend; E2 (food) conflicts with the app's own "Foods to try in this phase"; the wave 1 scripts, D3, C1 and C4 need a qualified clinician's review, which Codex cannot replace; voice provider and hosting need Jamie's approval.
- **Things changed since the last clips were made, and the films must say so:** PCOS was renamed polyendocrine metabolic ovarian syndrome (PMOS) in The Lancet in May 2026; Singapore published its first menopause guideline in February 2026 (median age of menopause 49; for most women with symptoms who are under 60 or within 10 years of their last period, the benefits of starting hormone therapy typically outweigh the risks); NICE replaced its fertility guideline (NG257, March 2026). NICE's heavy bleeding, miscarriage and ectopic, postnatal and menopause pages also show 2026 update dates; the recommendations used here were read on those pages, but an update date alone does not mean the advice we use changed (review).
- **Streaming:** progressive MP4 is the starting point; HLS is not needed for clips this short, subject to startup and stall tests before release. Two renditions: 720p by default, 1080p only when a film is played large. On a Mac the app is a 430 px column, so films need a "Watch large" theatre view to really fill the computer. The service worker must stop intercepting video. Wave 1 fits in the repo; all 27 films in two renditions (about 0.9 to 1.35 GB) will not fit in a GitHub Pages site, so hosting for later waves is chosen after measuring the first film, most likely object storage behind a CDN, which is Jamie's call because it costs money.

## How this was done

- **Triage:** `jevtriage` chose full depth with Gold Drop (0.76).
- **Protocol** (Gold Drop step 2): [protocol.md](2026-10-21-learn-videos/protocol.md). Reader: Jamie. Population: adult women 18+, Singapore first. Commercial interest disclosed, so app-capability claims got extra scrutiny.
- **What exists now:** every Learn clip measured with ffprobe, transcribed locally (faster-whisper, no cloud call) and checked frame by frame: [inventory.md](2026-10-21-learn-videos/inventory.md).
- **Evidence:** 61 PubMed records from 32 targeted searches through NCBI E-utilities, run one at a time; full text where PubMed Central or the publisher had it (FIGO 2018 and 2023, the 2023 PCOS guideline, ESHRE endometriosis 2022, ESHRE pregnancy loss 2022, the 2024 international POI guideline, ASRM on natural fertility 2022, the Singapore pilot and distress trial in JMIR); about 80 guideline and official pages opened in a headless browser, and 5 guideline PDFs (the full Singapore menopause consensus, two FSRH guidelines, the AASM sleep statement, HealthHub's cervical screening leaflet). These include NICE NG12, NG23, NG73, NG88, NG126, NG194 and NG257; ACOG patient FAQs; WHO fact sheets and postnatal guidance; CDC Hear Her; ASRM; RCOG; Royal College of Psychiatrists; KKH, SingHealth, MOH, HealthHub, SCDF, mindline and SOS. Each was read on the page itself, never from a search snippet. Ledger: [ledger.md](2026-10-21-learn-videos/ledger.md).
- **Codex Gate D** (gpt-6-astra, web search, read-only) saw only the question, the ledger, the old transcripts and a list of titles, before any card was written. Its findings were re-checked on the primary pages: [codex-gate-d.md](2026-10-21-learn-videos/codex-gate-d.md).
- **Codex draft review**, the same model on the finished draft, with the instruction to find errors: 32 findings, verdict "not ready". Each was checked against the code or the source, and all are dealt with below: [codex-draft-review.md](2026-10-21-learn-videos/codex-draft-review.md).

## What exists now, and whether it still fits

| Film | Length, shape | What it says | Verdict |
|---|---|---|---|
| A normal cycle (normal-v4) | 17.8 s, 720 x 720 | 21 to 35 day cycles, 2 to 7 day periods, mild PMS common; heavy bleeding, sudden changes, severe pain or bleeding between periods deserve a look | Retire. Ranges differ from FIGO (24 to 38 days, up to 8 days); good instinct on red flags, replaced by A1 and F1 |
| Hormones (hormones-v4) | 25.0 s, 720 x 720 | oestrogen "lifting energy, mood and skin"; "plan with your body" | Retire. No source supports the energy, mood and skin line, and phase effects on performance are small and inconsistent (McNulty 2020, Schlie 2025), so "plan with your body" overreaches; replaced by A2 |
| Fertile window (fertile-v4) | 20.4 s, 720 x 720 | six-day window (correct); egg-white mucus; "Ovaria reads your signs to pinpoint your unique window" | Retire now. Old brand and an accuracy claim the app cannot make; replaced by B1 |
| First period (menarche-v1) | 25.1 s, 960 x 960 | first period at 9 to 15; early cycles irregular | Retire. Out of scope for 18+ |
| Perimenopause (peri-v4) | 18.3 s, 720 x 720 | begins in your 40s; lasts 4 to 8 years; strength training, sleep, sometimes HRT; "they thrive" | Retire. No source fixes "4 to 8 years" (frequent hot flushes alone last a median 7.4 years in SWAN); "thrive" is a promise; replaced by D1 |
| Menopause (menopause-v1) | 27.7 s, 960 x 960 | 12 months without a period; around 51; "nearly a third of your life"; hormone therapy for many | Retire. Singapore's typical age is 49; captions are white on pale art and hard to read; replaced by D4 |

All six carry burnt-in captions and no text track, and all are square, so on a computer they sit in a narrow box. The four other clips in `assets/videos` (acupressure, back massage, breathing guide, a blooming flower) are 5 to 8 s loops for other screens and are out of scope.

## The proposed films

27 films in six groups (Gate D added A7 and D6). Waves: 1 for the friends launch, 2 within a month, 3 after that. Length is the narration target.

| ID | Film | Life stage | Length | Wave | Replaces |
|---|---|---|---|---|---|
| F1 | When to get care now | all | 90 s | 1 | |
| F2 | What Rhythme can and cannot tell you | all | 60 s | 1 | |
| A1 | What a typical adult cycle looks like | everyday | 90 s | 1 | normal-v4 |
| A3 | Heavy periods | everyday | 90 s | 1 | |
| A4 | Period pain and endometriosis | everyday | 90 s | 1 | |
| B1 | The fertile window, honestly | trying to conceive | 90 s | 1 | fertile-v4 |
| D1 | Perimenopause | perimenopause | 100 s | 1 | peri-v4 |
| A5 | PCOS, now also called PMOS | everyday, trying to conceive | 100 s | 2 | |
| B3 | When to ask for fertility help | trying to conceive | 75 s | 2 | |
| C1 | Early pregnancy loss (opt-in) | after pregnancy | 100 s | 2 | |
| C3 | Recovery after birth, and warning signs for a year | after pregnancy | 100 s | 2 | |
| C4 | Baby blues, postnatal depression and anxiety (opt-in) | after pregnancy | 100 s | 2 | |
| D2 | Hot flushes and night sweats | perimenopause, after menopause | 90 s | 2 | |
| D4 | After menopause: bones, heart and intimate health | after menopause | 90 s | 2 | menopause-v1 |
| D5 | Bleeding after menopause | after menopause | 60 s | 2 | |
| A2 | Your cycle's two halves | everyday | 75 s | 3 | hormones-v4 |
| A6 | Missed, irregular or in-between bleeding | everyday | 90 s | 3 | |
| A7 | Cervical screening in Singapore | everyday | 60 s | 3 | |
| B2 | Getting ready for pregnancy | trying to conceive | 75 s | 3 | |
| C2 | After a loss (opt-in) | after pregnancy | 90 s | 3 | |
| C5 | Periods, breastfeeding and contraception after birth | after pregnancy | 75 s | 3 | |
| D3 | Menopause hormone therapy, honestly | perimenopause, after menopause | 100 s | 3 | |
| D6 | Early menopause and POI | perimenopause | 75 s | 3 | |
| E1 | Sleep across the life stages | all | 90 s | 3 | |
| E2 | Food across the life stages | all | 75 s | 3 | |
| E3 | Moving your body | all | 75 s | 3 | |
| E4 | Mindfulness: what it can and cannot do | all | 75 s | 3 | |

menarche-v1 is retired with no replacement.

Total narration about 38 minutes (2280 s). On the desk, the "All videos" folder lists films by life stage; each life-stage folder (Cycle basics, Fertility, Life chapters, Mind and mood) shows its own films.

## What Codex's Gate D changed

Codex returned 28 findings ([full text](2026-10-21-learn-videos/codex-gate-d.md)). Every source it cited was opened again before use; all the decisive ones held up. The changes that matter most:

1. **Two kinds of heavy bleeding.** Heavy periods month after month (several hours of soaking every hour, coin-sized clots) need an appointment; that soaking happening now needs to be seen the same day (draft review, KKH). After a birth, soaking a pad in an hour or clots bigger than an egg need care now. Any bleeding with severe pain, faintness or breathlessness is an emergency.
2. **Never wait for a test.** Possible pregnancy with severe pain, shoulder tip pain or faintness means emergency care without waiting for a home test or an app (KKH ectopic page).
3. **Pregnancy warning signs last a year**, not six weeks (CDC), so C3 was renamed and F1 says to tell the clinician you are or were pregnant in the past year, including a pregnancy that ended in loss.
4. **Intrusive thoughts are not psychosis.** Unwanted, frightening thoughts of harm need prompt support from a doctor; the Royal College of Psychiatrists says people with perinatal OCD do not act on them. Hallucinations, confusion, any intention to harm, or feeling unable to stay safe are emergencies. C4 and F1 now separate the two, and neither tells someone with severe symptoms to wait two weeks.
5. **Bleeding after menopause** is a prompt appointment, not an ambulance, unless there are danger signs; UK referral rules do not transfer to Singapore.
6. **Singapore rules first**: fertility help after a year under 35 or six months from 35 (MOH, KKH), not NICE's 36; folic acid 400 micrograms (KKH); cervical screening as its own film (Healthier SG).
7. **The full Singapore menopause guideline** (12 points, 40 statements, commissioned by the College of O&G and the College of Family Physicians Singapore) replaced the press release as the main menopause source: median age 49, MHT benefits "typically outweigh" risks for most symptomatic women under 60 or within 10 years, not for preventing heart disease or dementia, progestogen protection when the womb is present, and premature ovarian insufficiency (now film D6).
8. **PMOS is real but transitional**: "PCOS, now also called PMOS", with a three-year changeover to the 2028 guideline (Monash); diagnostic criteria are unchanged. The NHS already uses the new name.
9. **Endometriosis**: imaging with treatment, or a keyhole operation, are both options with no proven winner (ESHRE 2022), so treatment is not a gate before referral. ACOG published a diagnosis guideline in March 2026, and NICE has draft guidance on a saliva test; neither is scripted.
10. **No hormone-optimisation stories**: cycle-phase effects on performance are small and inconsistent; appetite can rise before a period; no trials support phase diets. E2 was narrowed and A2 lost its "energy and skin" line.
11. **Mindfulness wording**: "not enough evidence to recommend it for hot flushes", not "proved not to work"; no promised calm.
12. **Streaming**: 720p by default, 1080p only in the theatre; measure stalls after launch; captions plus narrated visuals meet WCAG 1.2.2 and 1.2.5.

**One correction to an earlier Rhythme document.** The mindfulness Gold Drop's ledger row L57 describes the Singapore app pilot (Sparacio 2025) as "3 x 10 min/day". The paper says a 10-minute session daily for 3 days (E65). It does not change that review's conclusion, but the row should be corrected.

**Where Codex could not be confirmed:** Codex reported that it could not open NICE NG23, NG88, NG126 and NG257 from its sandbox; Claude opened all four in a browser, and their dates in the ledger are first-hand. Codex's notes on IMS 2025 (erratum) and ACOG's November 2026 menopause guideline are abstract-level only and are not used in any script; D2 and D3 need them read in full first.

## What the draft review changed

Codex then reviewed the finished draft and returned 32 findings with the verdict "not ready" ([full text](2026-10-21-learn-videos/codex-draft-review.md)). Each was checked against the code or the source before it was applied. All 32 were accepted, two of them in part:

- **Errors of mine it caught:** the app column is 430 px, not 520 (the 520 px rule never lifts `max-width:430px`), so on-screen text must be larger (now 80 px at 1080p); a second GitHub Pages site cannot hold both renditions of all 27 films either (now: measure the pilot, then choose hosting); the app already shows "Foods to try in this phase", so E2's line that Rhythme does not ask for phase eating was false (E2 is now on hold); F1 at 60 s was too short for its own words (now 90 s).
- **Safety wording:** heavy bleeding happening now needs same-day assessment, not just a booking; pregnancy pain thresholds now say "severe" and include dizziness everywhere; every film names symptoms and an action, never a destination alone, and KKH's centre is named only for what it handles; F1 includes pregnancies that ended in loss; unwanted frightening thoughts get prompt support, intent or psychosis an emergency; sleepy driving now says do not drive; contraception is planned to be in place by day 21; the breastfeeding contraception rule keeps its feeding-gap condition.
- **Clinical precision:** systemic versus vaginal oestrogen in D3; POI can allow pregnancy, and hormone therapy is not contraception (ESHRE and ASRM 2024 guideline, E81); menopause defined with its exclusions; populations restored (reproductive-age women, couples with a woman under 40); the 76% fertility-awareness figure and the competing miscarriage rates dropped; KKH's advice not to drink alcohol at all when trying; Healthier SG subsidy is for eligible Singapore Citizens.
- **Process:** clinician review is now required, not recommended, for the named scripts; Codex review is called an editorial check; transcripts are HTML, not Markdown; startup and stall tests move before release; the service worker bypass is by file extension; `-bufsize` is a buffer, not a rate.
- **Accepted in part:** Codex suggested telling viewers who mainly express milk to ask about other methods; the FSRH text found here only discusses expressing after emergency contraception, so that line was left out. It also cited a Singapore Police page for drowsy driving; the NHS sleep apnoea page (E84) was used instead, because it was opened here.

## The films, one card each

Each card gives the purpose, the key messages in the words the script should use, the red-flag line (spoken and shown), the see-a-doctor line, what the film must not say, and the sources (IDs in the [ledger](2026-10-21-learn-videos/ledger.md)). Lengths are narration targets at about 140 words a minute, so 90 s is about 200 words. Changes from Codex's Gate D are marked "(Gate D)"; changes from the draft review are marked "(review)".

**The emergency card.** Films whose topic has no emergency of its own end on this card instead of a topic red-flag line, so every film names symptoms and an action (review): "Bleeding with severe pain, dizziness or fainting; severe tummy or pelvic pain if you could be pregnant; chest pain or trouble breathing: call 995 or go to an emergency department."

### F1 When to get care now (wave 1, 90 s)
- **Purpose:** the signs that cannot wait, across every life stage. It also opens from the app's urgent care card, and the same list is shown there as text, so nobody has to watch a video in an emergency (Gate D).
- **Key messages:**
  - Bleeding that soaks through a pad or tampon every hour for several hours: get seen today. With severe pain, dizziness or fainting, or breathlessness: emergency now (review).
  - If you could be pregnant: severe tummy or pelvic pain, shoulder tip pain, or feeling dizzy or faint: emergency now, without waiting for a home test or an app. Milder pain or any bleeding: contact your doctor promptly (Gate D, review).
  - During pregnancy or in the year after, including after a loss: soaking a pad in an hour or clots bigger than an egg; fever of 38 C or more; chest pain or trouble breathing; a painful swollen leg; a severe headache or changes in vision: urgent care now. Tell the clinician you are pregnant or were pregnant in the past year (Gate D, review).
  - Hallucinations, strange beliefs or sudden confusion, any intention to harm yourself or someone else, or feeling unable to stay safe: emergency now. Unwanted, frightening thoughts that you do not want to act on: talk to a doctor promptly (review).
- **Red-flag line:** "In Singapore, call 995 or go to the nearest emergency department. For early pregnancy (under 22 weeks), after-birth and gynaecological emergencies, KK Women's and Children's Hospital runs a 24-hour urgent care centre." (review: KKH's centre is not a general emergency department)
- **See-a-doctor line:** "If you are thinking about suicide, call SOS on 1767 or mindline on 1771, day or night."
- **Must not say:** that the app can detect or rule out an emergency.
- **Sources:** E6, E7, E20, E22, E23, E42, E54, E55, E56, E78.

### F2 What Rhythme can and cannot tell you (wave 1, 60 s)
- **Purpose:** honest limits of the app, and how to use it with a doctor.
- **Key messages:** Rhythme keeps your own record; its dates are estimates worked out from your logged cycles, the period dates you remember, or the usual cycle length you entered, and it labels them as estimates (review); it cannot diagnose, confirm ovulation, act as contraception, or rule out pregnancy or an emergency; the timing of the fertile window can shift even when cycles are regular; the doctor share card turns your last four weeks into a summary you can show.
- **Red-flag line:** the emergency card.
- **See-a-doctor line:** "If something worries you, get it checked, whatever the app shows."
- **Must not say:** any accuracy figure; "predicts", "detects".
- **Sources:** E13, E58, A1 to A4.

### A1 What a typical adult cycle looks like (wave 1, 90 s; replaces "A normal cycle")
- **Purpose:** compare her own pattern with adult ranges, and know which changes are worth a check.
- **Key messages:** day 1 is the first day of real bleeding; outside pregnancy and the months after a birth, adult cycles usually come every 24 to 38 days, with bleeding for up to 8 days; your shortest and longest cycles can differ by up to about 7 to 9 days, and that limit depends on age (review); these ranges describe patterns and do not cancel out symptoms that worry you; in perimenopause and after a birth, cycles follow different rules (Gate D).
- **Red-flag line:** "Bleeding that soaks through every hour for several hours: get seen today. With severe pain, dizziness or fainting: emergency now."
- **See-a-doctor line:** "Book a check if your cycles are often shorter than 24 days or longer than 38, your period lasts more than 8 days, or you bleed between periods or after sex. You do not need months of logs first." (Gate D)
- **Must not say:** "28 days is normal", "you ovulate on day 14", or the old "21 to 35 days, 2 to 7 days" as the definition of normal.
- **Sources:** E1, E6, E7, E53.

### A2 Your cycle's two halves (wave 3, 75 s; replaces "Hormones")
- **Purpose:** explain the two halves of the cycle so the calendar makes sense.
- **Key messages:** the first half, before ovulation, is the part that varies most in length, so ovulation day moves between cycles and between people; after ovulation, the empty follicle (the corpus luteum) makes progesterone; if there is no pregnancy, progesterone falls, and that fall starts the period; studies find women eat a little more on average in the second half (review).
- **Red-flag line:** the emergency card.
- **See-a-doctor line:** "If your cycles are very irregular, a doctor can check whether you are ovulating."
- **Must not say:** that oestrogen lifts energy, mood or skin; that work, diet or training should be planned by phase (Gate D).
- **Sources:** E13, E58, E76, E85.

### A3 Heavy periods (wave 1, 90 s)
- **Purpose:** turn "is this normal?" into concrete signs, and say that help works.
- **Key messages:** heavy means heavy enough to get in the way of your life; signs over several periods include bleeding for more than 7 days, soaking a pad or tampon every hour for several hours in a row, needing two products at once or changing at night, and clots about the size of a 50-cent coin or bigger; if that pattern keeps happening, book an appointment (review); heavy periods can lower iron and make you tired or breathless; causes include fibroids, polyps, adenomyosis, irregular ovulation, bleeding disorders and some medicines; a doctor usually starts with a blood count, and there are effective treatments.
- **Red-flag line:** "Soaking through every hour for several hours right now: get seen today. With dizziness, fainting, breathlessness or severe pain: emergency now." (review)
- **See-a-doctor line:** "If periods have been heavy since your teens, or you bruise or bleed easily, ask about a bleeding disorder test."
- **Must not say:** that a pad count in the app diagnoses anything.
- **Sources:** E5, E6, E7, E44. The coin: ACOG says "a quarter" (24 mm); Singapore's 50-cent coin is about 23 mm; confirm the local swap in clinical review.

### A4 Period pain and endometriosis (wave 1, 90 s)
- **Purpose:** pain that stops normal life is not something to put up with, and what to ask for.
- **Key messages:** endometriosis affects about 1 in 10 women of reproductive age; signs include period pain that stops you doing daily things, pelvic pain outside periods, deep pain during or after sex, pain opening your bowels or passing urine around your period, and trouble getting pregnant alongside any of these; how bad the pain is does not show how much endometriosis there is; a symptom diary helps; a scan is often the first test, and a normal scan does not rule it out; imaging with treatment, and a keyhole operation, are both options, neither has been shown to control symptoms better, and the choice depends on you (Gate D, review).
- **Red-flag line:** "Sudden severe pelvic pain, pain with fever, or severe pain if you could be pregnant: emergency now."
- **See-a-doctor line:** "Bring your Rhythme pain log and ask whether endometriosis could be the reason."
- **Must not say:** that the app can detect endometriosis; that surgery is always needed for a diagnosis; that treatment must be tried before referral; anything about saliva tests (draft UK guidance only).
- **Sources:** E8, E9, E10, E11, E62; E63 and E64 noted, not scripted.

### A5 PCOS, now also called PMOS (wave 2, 100 s)
- **Purpose:** the condition, its new name, what diagnosis needs, and why it matters for long-term health.
- **Key messages:** about 1 in 8 women of reproductive age have it (review); in May 2026 an international consensus renamed polycystic ovary syndrome "polyendocrine metabolic ovarian syndrome", because the "cysts" are not cysts and the condition affects hormones and metabolism; both names will be used during a three-year changeover, and the way it is diagnosed has not changed (Gate D); signs include irregular or missing periods, extra hair growth or acne, and trouble getting pregnant; in adults, diagnosis needs two of three features (irregular ovulation, signs or blood tests of high androgens, many follicles on ultrasound or a high AMH) after other causes are ruled out, and the rules differ for younger people (review); it raises the chance of type 2 diabetes, so regular checks matter.
- **Red-flag line:** the emergency card.
- **See-a-doctor line:** "If your cycles are often longer than 35 days or you have fewer than 8 periods a year, ask your doctor about PCOS." (This is the PCOS guideline's own threshold for irregular cycles in adults, which is stricter than FIGO's general range; the script says so.)
- **Must not say:** that an app, one blood test or an ultrasound alone diagnoses it; any cure or diet claim; that everyone has adopted the new name.
- **Sources:** E2, E3, E4, E61, E83; the NHS already says "PMOS, which used to be called PCOS" (E50 page, reviewed 12 Jun 2026).

### A6 Missed, irregular or in-between bleeding (wave 3, 90 s)
- **Purpose:** what to check for the common surprises.
- **Key messages:** if a period is late and you could be pregnant, take a test, but severe pain, shoulder tip pain, dizziness or fainting means emergency care without waiting for a test (Gate D, review); bleeding between periods or after sex needs a doctor's check even if your last screening test was normal (Gate D); stress, sudden weight loss, being overweight, a lot of exercise, breastfeeding, some contraception, perimenopause, PCOS and thyroid problems can all change cycles.
- **Red-flag line:** F1's pregnancy line.
- **See-a-doctor line:** "Missed 3 periods in a row and not pregnant, or bleeding after sex: book a check."
- **Must not say:** that a late period means nothing; any cause inferred from app data.
- **Sources:** E2, E50, E53, E54.

### A7 Cervical screening in Singapore (wave 3, 60 s; new after Gate D)
- **Purpose:** screening on its own, separate from symptoms.
- **Key messages:** from 25, if you have ever been sexually active: a Pap test every 3 years from 25 to 29, then an HPV test every 5 years from 30; Singapore Citizens enrolled in Healthier SG get it subsidised, and others should ask about charges (review); screening is for people without symptoms, so bleeding after sex or between periods needs a check whatever your last result was.
- **Red-flag line:** the emergency card.
- **See-a-doctor line:** "Not sure when you were last screened? Ask your clinic."
- **Must not say:** that a normal result rules out the need to check symptoms.
- **Sources:** E43, E69.

### B1 The fertile window, honestly (wave 1, 90 s; replaces "Fertile window")
- **Purpose:** the six-day window and its limits, replacing the old "pinpoint" claim.
- **Key messages:** pregnancy comes from sex in the five days before ovulation or on the day itself, and the chance is highest in the two days before ovulation; the timing of that window can shift a lot, even when cycles are regular, so a calendar estimate is a guess; changes in vaginal discharge, body temperature and ovulation tests are clues, not proof that ovulation happened (Gate D), and discharge changes predicted the most fertile days better than a calendar in one large study; sex every 2 to 3 days through the cycle covers the window without timing it exactly; Rhythme has not been tested as contraception, so do not use its dates to find "safe days" (review).
- **Red-flag line:** the emergency card.
- **See-a-doctor line:** see B3.
- **Must not say:** "pinpoint", "your unique window", any accuracy figure for the app, safe days, or that fertility awareness is reliable birth control.
- **Sources:** E12, E13, E14, E16, E48, E58.

### B2 Getting ready for pregnancy (wave 3, 75 s)
- **Purpose:** the few steps with strong support.
- **Key messages:** take folic acid 400 micrograms (0.4 mg) a day from before conception until 12 weeks; a doctor may prescribe a higher dose if you have had a baby with a neural tube defect, have diabetes, take epilepsy medicines, or have a BMI over 30; the safest choice while trying is not to drink alcohol at all (review); if you have a long-term condition or take regular medicines, talk to your doctor before trying.
- **Red-flag line:** the emergency card.
- **See-a-doctor line:** "Not pregnant after a year (or six months from 35): see B3."
- **Must not say:** that everyone needs a higher dose; any other supplement as boosting fertility.
- **Sources:** E17, E46, E68, E82.

### B3 When to ask for fertility help (wave 2, 75 s)
- **Purpose:** clear Singapore timing, so nobody waits too long or worries too early.
- **Key messages:** most couples where the woman is under 40 conceive within a year of regular sex without contraception (review); in Singapore, see a doctor after a year of trying if you are under 35, or after six months if you are 35 or older; go sooner if periods are irregular or absent, or you or your partner have a condition that could affect fertility; polyclinics, GPs and fertility clinics can start the tests (Gate D: Singapore rule, not NICE's).
- **Red-flag line:** the emergency card.
- **See-a-doctor line:** the key message itself.
- **Must not say:** a personal chance figure; a fixed number of months to wait if something is already wrong.
- **Sources:** E14, E15, E67, E68.

### C1 Early pregnancy loss (wave 2, 100 s, opt-in with a content note)
- **Purpose:** what happens, that it is common and almost never her fault, and the signs that need care now.
- **Key messages:** early pregnancy loss is common, about 10 in 100 known pregnancies (ACOG) (review); most early losses happen because the embryo did not develop properly; work, exercise, sex and past pill use do not cause it; bleeding is the most common sign, and light bleeding in early pregnancy can also happen without a loss; an ectopic pregnancy grows outside the womb and can bleed inside the body (Gate D).
- **Red-flag line:** "Heavy bleeding, severe pain, shoulder tip pain, dizziness or fainting: emergency now, without waiting for a test." (review)
- **See-a-doctor line:** "Milder pain or any bleeding in early pregnancy: call your doctor, or go to KKH's 24-hour urgent care centre if you are under 22 weeks."
- **Must not say:** that she caused it; that stress can never matter (say "almost never" as ACOG does) (Gate D); a "normal" amount of bleeding; treatment instructions.
- **Sources:** E7, E18, E20, E54.

### C2 After a loss (wave 3, 90 s, opt-in)
- **Purpose:** grief is real, support exists, and when to ask about tests.
- **Key messages:** grief, anxiety and low mood after a loss are common and can affect partners too; support is for any loss, not only repeated ones (Gate D); specialists differ on when tests start (two losses in European guidance, three in UK guidance with discretion at two), so ask your doctor; when to try again depends on what happened and on you, and your team will advise.
- **Red-flag line:** "Any intention to end your life, or feeling unable to stay safe: call 995. To talk, SOS 1767 answers day and night."
- **See-a-doctor line:** "If low mood or anxiety is not easing, or is getting in the way of daily life, talk to your doctor. You do not have to wait." (Gate D)
- **Must not say:** a guaranteed outcome next time; a single universal waiting time.
- **Sources:** E19, E21, E42, E72.

### C3 Recovery after birth, and warning signs for a year (wave 2, 100 s)
- **Purpose:** what healing looks like, and the warning signs, which do not stop at six weeks (Gate D).
- **Key messages:** bleeding after birth (lochia) slowly gets lighter and usually stops by 6 to 8 weeks, though it can last longer; pain that is getting worse is not part of normal healing and should be checked; pelvic floor exercises help; in Singapore your doctor usually sees you again at 4 to 6 weeks, but do not wait for that visit if something is wrong; contraception needs to be in place by day 21, so plan it before the postnatal visit (review); serious problems linked to pregnancy can appear up to a year after birth, so always mention a recent pregnancy (Gate D).
- **Red-flag line:** "Soaking a pad in an hour, clots bigger than an egg, fever of 38 C or more, chest pain, trouble breathing, a painful swollen leg, a severe headache or vision changes: emergency now."
- **See-a-doctor line:** "Pain that gets worse, a wound that opens or smells, or bleeding that gets heavier again: see a doctor the same day."
- **Must not say:** that problems after six weeks are not pregnancy-related.
- **Sources:** E22, E23, E27, E49, E70, E71.

### C4 Baby blues, postnatal depression and anxiety (wave 2, 100 s, opt-in)
- **Purpose:** tell common blues from depression and anxiety that need help, and how to get it.
- **Key messages:** up to 2 in 3 new mothers have baby blues, usually starting in the first days and passing within 1 to 2 weeks; about 1 in 10 have postnatal depression, which lasts longer and makes everyday life hard, and anxiety can be the main feature; both are treatable; some new parents have sudden, unwanted, frightening thoughts about harm coming to their baby, and these deserve prompt support from a doctor (review); postpartum psychosis is rare (about 1 in 1,000 births), usually starts in the first two weeks, and is a psychiatric emergency.
- **Red-flag line:** "Hallucinations, strange beliefs, sudden confusion, any intention to harm yourself or your baby, or feeling unable to stay safe: call 995 or go to an emergency department now. SOS 1767 and mindline 1771 answer any time." (review)
- **See-a-doctor line:** "Low mood or worry that lasts beyond two weeks, or that is severe sooner: talk to your doctor. HealthHub has a self-check." (Gate D: do not tell anyone with severe symptoms to wait two weeks)
- **Must not say:** that intrusive thoughts mean someone is dangerous; any diagnosis of OCD from the film; "these thoughts are never acted on" as a blanket promise (review).
- **Sources:** E24, E25, E42, E55, E56.

### C5 Periods, breastfeeding and contraception after birth (wave 3, 75 s)
- **Purpose:** you can get pregnant before your first period comes back.
- **Key messages:** if you are not breastfeeding, ovulation can return within weeks, before any period; contraception is not needed in the first 21 days but is from day 21, so plan it early (review); breastfeeding works as contraception only while all of these hold: your baby is under 6 months, your periods have not come back, and you are fully or nearly fully breastfeeding day and night with no gaps longer than about 4 hours by day or 6 hours at night (review); bleeding in the first weeks is usually lochia, not a period (review).
- **Red-flag line:** the emergency card.
- **See-a-doctor line:** "Talk about contraception before you go home from hospital, or as soon as you can."
- **Must not say:** that breastfeeding is reliable contraception on its own.
- **Sources:** E27, E49, E52.

### D1 Perimenopause (wave 1, 100 s; replaces "Perimenopause")
- **Purpose:** what changes, how it is recognised, and that help exists.
- **Key messages:** changes in your periods are often an early sign (review); in Singapore the commonest symptoms are new joint and muscle aches, poor sleep, vaginal and urinary changes, and exhaustion, then hot flushes and night sweats; over 45, doctors usually recognise it from your symptoms and periods without a blood test; how long it lasts varies a lot (Gate D); pregnancy is still possible, so keep using contraception until your doctor says you can stop (for most women by 55); symptoms or stopped periods before 45 deserve a check, because early menopause has its own care (Gate D); many women with moderate or severe symptoms never ask for help, and effective treatments exist.
- **Red-flag line:** "Very heavy bleeding with dizziness: emergency now. Bleeding after sex or between periods: book a check."
- **See-a-doctor line:** "If symptoms affect your sleep, work or relationships, talk to your doctor."
- **Must not say:** "thrive"; a fixed duration such as "4 to 8 years"; that a hormone test confirms it.
- **Sources:** E28, E29, E32, E59.

### D2 Hot flushes and night sweats (wave 2, 90 s)
- **Purpose:** what actually reduces them.
- **Key messages:** frequent hot flushes often last years (a median of about 7 years in one large US study); hormone therapy is the most effective treatment, and Singapore's guideline makes it the first choice for women who can use it; if it is not suitable or you prefer not to, doctors can offer non-hormonal prescription medicines, and UK and US guidance also support menopause-specific CBT; paced breathing is not recommended for hot flushes, there is not enough evidence to recommend mindfulness for them, and black cohosh and plant oestrogens have uncertain benefit and safety (review).
- **Red-flag line:** the emergency card.
- **See-a-doctor line:** "If flushes disturb your sleep or work, ask about treatment."
- **Must not say:** that mindfulness or breathing exercises treat hot flushes; drug brand names.
- **Sources:** E28, E30, E31, E36, E59. ACOG's 2026 guideline on these symptoms (E74) must be read in full before scripting.

### D3 Menopause hormone therapy, honestly (wave 3, 100 s, clinician review required)
- **Purpose:** a balanced picture in Singapore's own words.
- **Key messages:** MHT is the most effective treatment for hot flushes and also prevents and treats bone thinning; Singapore's 2026 guideline says that for most women with symptoms who are under 60 or within 10 years of their last period, the benefits of starting MHT typically outweigh the risks; the type and dose are chosen with your doctor after a check of your own risks; if you still have a womb, systemic oestrogen (tablets, patches or gel) is given with a progestogen to protect it; MHT is not used to prevent heart disease or dementia in women without symptoms; low-dose vaginal oestrogen for dryness and urinary symptoms is a separate, local treatment with its own considerations; if you have had breast or another hormone-sensitive cancer, your doctors will decide with you (Gate D, review).
- **Red-flag line:** "Heavy bleeding: emergency care. New or continuing unexpected bleeding on MHT: book a check promptly."
- **See-a-doctor line:** "Ask your doctor whether MHT suits you."
- **Must not say:** "MHT is safe" unqualified; any figures from the US FDA's 2025 press release; that US label changes apply in Singapore (Gate D).
- **Sources:** E28, E47, E59, E60; E73 and E74 to be read in full before scripting.

### D4 After menopause: bones, heart and intimate health (wave 2, 90 s; replaces "Menopause")
- **Purpose:** what to look after once periods have stopped.
- **Key messages:** natural menopause is recognised after 12 months without a period when nothing else explains it; hormonal contraception and some operations can hide the pattern, so your doctor may need to judge it differently (review); in Singapore the median age is 49; menopause raises the risk of thin bones, and healthy habits (regular exercise, a healthy weight, enough calcium and vitamin D, not smoking, less alcohol) lower long-term risks to bones and heart; every woman after menopause should have her bone risk assessed; vaginal dryness, pain with sex and urinary symptoms are common and treatable, starting with moisturisers and lubricants and, if needed, vaginal oestrogen.
- **Red-flag line:** "Any bleeding after menopause, even once: arrange a doctor's appointment promptly. Heavy bleeding, severe pain or fainting: emergency now." (review)
- **See-a-doctor line:** "Ask about your bone risk, especially after early menopause or a fracture from a minor fall."
- **Must not say:** "around 51" for Singapore; "a third of your life" unless attributed.
- **Sources:** E28, E29, E59.

### D5 Bleeding after menopause (wave 2, 60 s)
- **Purpose:** one message: always get it checked.
- **Key messages:** any bleeding or spotting after menopause needs a doctor's appointment, even if it is light or happened once; most of the time it is not cancer, but it can be an early sign of womb cancer, which is easier to treat when found early (review); this is a prompt appointment, not usually an emergency (Gate D).
- **Red-flag line:** "Heavy bleeding, severe pain or feeling faint: emergency now."
- **See-a-doctor line:** "Book an appointment promptly. On MHT, new or unexpected bleeding also needs a check."
- **Must not say:** that bleeding on MHT is always normal; UK referral rules or waiting times; a Singapore cancer rate (the 9% pooled figure in E35 varies by region and HRT use) (review).
- **Sources:** E34, E35, E57.

### D6 Early menopause and POI (wave 3, 75 s; new after Gate D)
- **Purpose:** periods stopping early, or after cancer treatment or surgery, need their own care.
- **Key messages:** premature ovarian insufficiency (POI) means the ovaries work much less than usual before 40, and periods may become irregular or stop; it can happen on its own or after chemotherapy, radiotherapy or removal of both ovaries; it needs a doctor's assessment, and hormone therapy is usually offered until at least the usual age of menopause, to protect bones and heart; when POI was not caused by surgery, the ovaries can still work now and then, so pregnancy is possible, and contraception is needed if you want to avoid pregnancy; hormone therapy is not contraception (review); fertility and emotional support are part of care; if you are facing cancer treatment, ask about fertility and menopause before it starts.
- **Red-flag line:** the emergency card.
- **See-a-doctor line:** "Periods stopping, or menopause symptoms, before 45: see a doctor."
- **Must not say:** that POI always means no chance of pregnancy.
- **Sources:** E59, E81.

### E1 Sleep across the life stages (wave 3, 90 s)
- **Purpose:** what helps sleep, honestly.
- **Key messages:** for adults aged 18 to 60, the recommendation is 7 or more hours on a regular basis (review); poor sleep is one of the commonest menopause symptoms in Singapore; for ongoing insomnia, CBT for insomnia is the recommended treatment and sleep tips alone are not enough; breathing that stops and starts in sleep, with loud snoring or gasping, needs a check for sleep apnoea.
- **Red-flag line:** "If you feel very sleepy, do not drive. If you have nodded off at the wheel, stop driving and see a doctor before you drive again." (review)
- **See-a-doctor line:** "When sleep problems are affecting your day, ask your doctor about CBT for insomnia." (review)
- **Must not say:** that tracking sleep in the app improves it.
- **Sources:** E29, E39, E40, E51, E84.

### E2 Food across the life stages (wave 3, 75 s; on hold until the app's phase foods are reconciled)
- **Purpose:** the few food points with clear support.
- **Key messages:** heavy periods can lower iron, so tiredness with heavy periods is worth a blood test; folic acid before pregnancy (B2); after menopause, enough calcium and vitamin D for bones; studies find women eat a little more on average before a period, which is common; a limited search found no trials showing that eating differently in each cycle phase improves symptoms or health (review).
- **Red-flag line:** the emergency card.
- **See-a-doctor line:** "Tiredness with heavy periods: ask for a blood count before taking iron for months."
- **Must not say:** any "cycle syncing" benefit; a full nutrient plan by life stage (Gate D).
- **Conflict with the app (review):** the diary shows "Foods to try in this phase" and phase tips (`room.js` PHASE_TIPS at line 146 and `picksHTML` at line 943, A3). E2 cannot ship until that content is reconciled with this evidence; that is a content decision for Jamie.
- **Sources:** E5, E6, E46, E59, E76, E77, A3.

### E3 Moving your body (wave 3, 75 s)
- **Purpose:** the guideline amounts, and that cycle phase need not decide training.
- **Key messages:** for most adults, 150 to 300 minutes of moderate activity a week plus regular muscle strengthening, and some activity is better than none; in pregnancy and after a birth there is adapted advice, so build up gradually (review); studies of cycle phase and performance show small and inconsistent effects, so go by how you feel (Gate D); after a birth, start pelvic floor exercises.
- **Red-flag line:** "Chest pain or fainting during exercise: stop and call 995." (review)
- **See-a-doctor line:** "After a birth or surgery, ask when to restart harder exercise."
- **Must not say:** phase-based training plans; that exercise treats hot flushes.
- **Sources:** E22, E30, E37, E38, E75.

### E4 Mindfulness: what it can and cannot do (wave 3, 75 s)
- **Purpose:** honest expectations for the mat and Erin's practices.
- **Key messages:** in trials, mindfulness programmes ease stress and low mood a little for some people, with the clearest results from structured courses with a teacher, and those results do not show what Rhythme's short practices can do (review); there is not enough evidence to recommend it for hot flushes, and no fertility benefit has been shown (Gate D, review); you can stop any practice, open your eyes, or switch to a moving one.
- **Red-flag line:** "Any intention to harm yourself, or feeling unable to stay safe: call 995. To talk, SOS 1767 or mindline 1771, day or night." (review)
- **See-a-doctor line:** "Low mood that is not easing: talk to your doctor."
- **Must not say:** "minutes of calm" as a promise; any treatment claim; that meditation is dangerous.
- **Sources:** E30, E41, E42, E65, E66.

### Asked for by Gate D, not yet carded
Codex named topics a gynaecologist, perinatal psychiatrist or menopause specialist would expect. They are real gaps, but their evidence pass is not done, so they are listed rather than scripted:
- Contraception, including emergency contraception, in Singapore (needs HealthHub and HSA sources on access).
- PMS and PMDD (ACOG Clinical Practice Guideline 7, 2023, E80, abstract only so far).
- Breast awareness and breast screening (Healthier SG).
- Pelvic floor recovery after birth (NICE NG210).
- Persistent tiredness: iron and thyroid.
- Optional, text-first and specialist-reviewed: stillbirth, termination of pregnancy, and relationship safety. These should not be compressed into short clips.

## Script rules for every film

1. **One purpose per film**, 60 to 120 seconds, about 140 spoken words a minute. The key messages above are the content; the script adds only connecting words.
2. **Every clinical film ends on two cards**, spoken and shown: the red-flag line (or the shared emergency card, which names its own symptoms) and the see-a-doctor line. Each names the symptom and the action, never a destination alone. Singapore numbers are spoken in full: 995, SOS 1767, mindline 1771. Overseas viewers see "or your local emergency number".
3. **No diagnosis, no prediction claims, no guaranteed outcomes.** Banned words: pinpoint, detect, diagnose (for the app), cure, thrive, safe (unqualified), proven, normal (as a verdict on her body; use "within the usual range").
4. **Numbers come only from the ledger**, with the source shown in the transcript and on a final "Sources" card. Every number is rounded the way the source rounds it.
5. **Singapore first.** Use Singapore sources where they exist (the 2026 Singapore menopause consensus, MOH and KKH on fertility and folic acid, HealthHub and Healthier SG screening); label UK or US thresholds as such in the transcript.
6. **No em dashes** in narration, captions, cards or transcripts. Plain words; explain a medical term once, the first time it is used.
7. **Content notes and opt-in** for pregnancy loss (C1, C2) and for the postnatal mood film (C4): a still title card with "This film talks about miscarriage" (or "about suicide and harm") and two buttons, Watch and Not now. These films never autoplay and never appear as suggestions after another film.
8. **Clinical review before render.** Every script is checked by Codex gpt-6-astra with web search against this ledger; that is an editorial check, not clinical sign-off. A qualified clinician's review is required before rendering the wave 1 scripts and D3, C1 and C4 (review). A script changes only by going back through review.
9. **The app's own claims.** A film may describe what Rhythme does only if the feature exists in the live build, with the same words the app uses.

## Production plan (needs Jamie's approval; nothing has been made)

### Look: Seedance for moving pictures, code for every word (Jamie's choice, 20 Oct 2026)
Jamie asked for the films to be made with Volcengine's Seedance model. The plan splits each film into two layers so the model never carries a clinical claim:

- **Seedance draws mood and place.** About half of each film's runtime is Seedance footage: 4 to 8 shots of 5 to 10 s in Rhythme's soft watercolour look, such as a bedroom at dawn, a desk with a calendar, tea on a windowsill, a walk in a garden, a clinic entrance seen from a distance. Each shot starts from a keyframe made with Seedream 5.0 pro in the app's style (the illustrated avatar can be the reference; she is not a real face, which matters because Seedance 2.0 refuses real human faces as reference input, V4).
- **Code draws every word and diagram.** Titles, key messages, cycle wheels and timelines, the red-flag and see-a-doctor cards, the sources card and the caption line are built in HyperFrames (or Remotion) over the footage or a still keyframe, so each word on screen is exactly the reviewed script.
- **Never in a Seedance prompt:** anatomy, procedures, blood beyond soft abstract colour, pregnancy loss imagery, text, numbers, logos, real people, hospital brands. Every accepted shot is checked frame by frame for stray text, warped hands and faces, and anything that reads as medical advice.
- **Settings:** `ratio "16:9"`, `resolution "1080p"`, `duration` 5 to 10, `generate_audio false` (narration and music are added separately, and the default is true), `watermark false`, `camera_fixed true` for still moods where the 2.0 series accepts it (the API lists it; the 2.0 tutorial does not), `seed` recorded per shot so a take can be redone. Output is 24 fps (V1, V2), so the films are mastered at 24 fps rather than 30, and the encode settings use `-g 48` for 2-second keyframes.

**Which Seedance.** Seedance 2.0 (`doubao-seedance-2-0-260128`) for final shots: 16:9, 1080p, 4 to 15 s, image-to-video from a first frame, and the cheapest 1080p option. Seedance 2.5 (`doubao-seedance-2-5-260628`, 4 to 30 s, a 480p draft mode before the full render) only if 2.0 fails the pilot's look. The fast and mini versions stop at 720p, so they are not used for finals (V2).

**Cost at list prices** (opened 20 Oct 2026; tokens = seconds x width x height x fps / 1024, so 1080p at 24 fps is 48,600 tokens a second; failed generations are not billed; no promotion applies to 2.0 standard on that date) (V3, V5). Estimates assume half of each film is Seedance footage and 50% spare for rejected takes; Seedream keyframes add about 0.30 yuan (US$0.045) each:

| | per second | A1 pilot (about 68 s rendered) | Wave 1 (about 460 s) | All 27 films (about 1,710 s) |
|---|---|---|---|---|
| Seedance 2.0, 1080p, Volcengine | 2.48 yuan | about 170 yuan | about 1,130 yuan | about 4,240 yuan |
| Seedance 2.0, 1080p, BytePlus | US$0.37 | about US$25 | about US$170 | about US$640 |
| Seedance 2.5, 1080p, Volcengine | 3.74 yuan | about 250 yuan | about 1,710 yuan | about 6,400 yuan |
| Seedance 2.5, 1080p, BytePlus | US$0.57 | about US$38 | about US$260 | about US$970 |

Volcengine also requires an account balance over 200 yuan (or a Seedance resource pack or savings plan) before Seedance 2.0 can be switched on (V2).

**Which account (Jamie's decision).** The Volcengine Ark platform terms the launch sweep found also cover Seedance. Clause 3.1 grants use "仅在中国大陆地区" (only in mainland China) and says commercial use needs Volcengine's prior written permission (V6). Rhythme is a Singapore product, so making its films on the existing cn-beijing account carries the same problem that paused Luna's AI. ByteDance's international platform, **BytePlus ModelArk**, sells the same Seedance 2.0 and 2.5 models (`dreamina-seedance-2-0-260128`, `dreamina-seedance-2-5-260628`) in US dollars, lists Singapore as an available country, and costs about the same (V5, V7). Recommendation: run Seedance on a BytePlus ModelArk account. It needs Jamie to sign up and create an API key; the scripts are the same apart from the base URL and model IDs. This is a terms reading, not legal advice.

**Pilot first.** Make A1's footage only: about 8 shots of Seedance 2.0 at 1080p from Seedream keyframes, plus 2 of the same shots in Seedance 2.5 to compare, in one guarded run. Visuals carry no clinical claims, so the pilot can run before the clinician review; the finished film cannot. Jamie then judges the look, and the measured file sizes settle the hosting question.

**Pilot result (21 Oct 2026, on the existing Volcengine account at Jamie's request).** Jamie asked for the films in the app's current dreamy look with the avatar in them, so the pilot made A1's visuals that way:
- Keyframes: Seedream 5.0 pro at 1664 x 936 with two references, a character sheet of the app's own avatar sprites and the room plate. Three of four came out right first time; the evening-tea frame showed the girl twice and was redone with "exactly one girl, shown only once". Five keyframe renders cost about 1.60 yuan.
- Motion: Seedance 2.0, 1080p, 16:9, 5 s, from each keyframe, audio off. Each shot used 245,025 tokens, 12.50 yuan, exactly the list-price estimate, and took 2 to 6 minutes. Output is 1920 x 1080 at 24 fps, and the avatar stayed on model through the motion (stretching at dawn; moon lanterns swaying while she blinks).
- Two hiccups, both stopped by the run rules: Seedream 5.0 pro now rejects the `stream` parameter (a rejected call is not billed), and a status check on shot 2 hit a network timeout, so the run stopped before shots 3 and 4 started. Shot 2 had already been submitted, so it was collected with free status checks rather than wasted.
- Spent so far: 26.60 yuan. Shots 3 and 4 (about 25 yuan) wait for Jamie's go-ahead.
- Measured file size: the 18-second preview is 8.5 MB at 1080p (3.7 Mbit/s) and 4.2 MB at 720p (1.9 Mbit/s), higher than the estimate in the size budget because of the sparkle and petal motion. At that rate an 84-second film is about 39 MB plus 20 MB, and all 27 would be about 1.6 GB, so the films must be hosted off GitHub Pages; a CRF of 24 to 25 should be tried on the next encode before deciding.

### Voice
Use one warm, neutral narrator for all clinical films. Seedance's own audio is switched off, because the narration must be the reviewed script word for word. Options, each to be checked for licence before any run:
- Higgsfield text-to-speech with an existing brand voice (Jamie's standing default for voiceovers);
- Erin, recorded or her cloned voice, only for E4 (mindfulness), so her voice stays tied to practice; her clone runs on Volcengine speech, whose terms need the same check as Seedance (V6);
- a local model (for example Kokoro) as a no-cost fallback.
MiniMax is not an option.

### Order of work, once approved
1. Retire the menarche clip and the fertile-window clip (old brand and the "pinpoint" claim) from the Learn desk now (a small app change, separate PR).
2. Seedance pilot for A1's footage (above), on the account Jamie picks; Jamie approves the look.
3. Write the wave 1 scripts (F1, A1, A3, A4, B1, D1, F2) from these cards; Codex check; qualified clinician review; Jamie approves the words.
4. Assemble A1 end to end (footage, code-drawn cards, narration, WebVTT) and check it against the spec and file-size budget; Jamie approves.
5. Render the rest of wave 1 in one guarded batch: a single job lock, already-finished shots skipped, no automatic retries, stdout and stderr checked for usage, rate, credit and moderation errors even when the exit code is 0, the whole batch stopped and the block saved on the first provider failure, and approval used up after one run.
6. Ship wave 1 with the player changes and the service worker fix; choose hosting for waves 2 and 3 from the pilot's measured sizes.

### What Jamie approves
- the film list and waves (this document);
- the Seedance account (BytePlus recommended) and each paid run, starting with the A1 pilot (about US$25 or 170 yuan);
- the voice provider (after its licence check) and any spend on Higgsfield credits;
- hosting for waves 2 and 3, if it costs money;
- what to do with the app's phase food suggestions before E2;
- each wave's scripts, and the assembled A1 film before the batch.

## Desktop streaming spec

### Where the video plays
On a Mac, the whole app is one column: `.frame` has `max-width:430px` (`room.css` line 19), and the wide-screen rule at line 23 sets `width:min(100%,520px)` without lifting that cap, so the column stays 430 px wide (review). The sheet body has 16 px padding each side (line 190), so the Learn desk, and any player inside it, is about 398 px wide; the current player is also capped at 240 px tall (line 291). A 16:9 film there is about 398 x 224 px. "Fits the computer" therefore needs two places to play:

1. **Inside the desk screen (default).** The film plays in the 16:10 wallpaper area of the in-app computer, like a QuickTime window over the desktop, letterboxed by 5% top and bottom. Captions show as a text line under the screen in the app's own font (from the WebVTT cues), because native caption text at that size is too small to read.
2. **Watch large (theatre).** A button on the player opens a full-window overlay outside the 430 px column: width `min(92vw, (92vh - 96px) * 16/9)`, dark backdrop; Escape and a close button return to the desk, and focus goes back to the button that opened it. Native fullscreen stays available from the controls, and entering or leaving it keeps the playback position. Native captions (the `<track>`) are on by default here.

### Picking the file
**720p is the default everywhere** (in the desk, on phones, and whenever `navigator.connection.saveData` is true). **1080p is used only in Watch large or fullscreen**, when the drawn width times `devicePixelRatio` is 1,400 px or more; if 1080p has not started within a few seconds or stalls, it falls back to 720p at the same position. The choice is made when play is pressed or the theatre opens or closes, never mid-play otherwise. Choosing by player size is not network adaptation (Gate D), so time to first frame and stalls are measured **before release** on a phone on mobile data and on a Mac (review). `<source media>` is not used, because it is evaluated once at load and would not follow the theatre switch.

### Files per film
| File | Spec |
|---|---|
| `<id>-v1-1080.mp4` | 1920 x 1080, 16:9, square pixels, 24 fps (Seedance renders at 24, V1), H.264 High profile level 4.1, yuv420p, Rec. 709 SDR, keyframe every 2 s (`-g 48 -keyint_min 48 -sc_threshold 0`), capped VBR (`-crf 22 -maxrate 4.5M -bufsize 9M`, a 9 Mbit VBV buffer) (review), `-movflags +faststart`; AAC-LC 48 kHz, 128 kbit/s stereo |
| `<id>-v1-720.mp4` | 1280 x 720, same settings, `-maxrate 2.5M -bufsize 5M` |
| `<id>-v1.en.vtt` | WebVTT captions, at most 2 lines and about 42 characters a line, cues 1 to 7 s, sound labels in brackets only when needed; the source for both the native track and the app's caption line |
| `<id>-v1.jpg` | poster, 1920 x 1080 JPEG about 150 KB, the title card (not a mid-sentence frame) |
| `<id>-v1-thumb.webp` | 480 x 270 thumbnail for the Finder list (the current list uses 512 x 512 squares) |
| `learn/<id>-v1.html` | the reviewed script as a descriptive transcript with sources, opened from the player as "Transcript and sources". HTML, not Markdown: the Pages workflow uploads the folder as is (`.github/workflows/deploy.yml`), so a `.md` file would show as raw text (review) |

The `-v1` stays in every file name, so a corrected film gets a new name and caches never mix versions.

Bit rates: Apple's HLS authoring spec lists 1920 x 1080 H.264 variants at 6,000 and 7,800 kbit/s and 1280 x 720 at 3,000 and 4,500 kbit/s (T4); it is an example ladder for any content, not a recipe (Gate D). These films are mostly still illustration and slow motion graphics, so the caps above are lower; check the first encode by eye at 100% and raise the cap only if text edges smear.

### Picture rules that follow from the small screen
In the desk, a 1080p frame is drawn about 398 px wide, about 0.21 of its size; on a 375 px phone it is about 343 px, about 0.18 (review). So:
- on-screen text at least 80 px tall at 1080p (about 14 to 17 CSS px in the desk), headings 110 px or more; that allows only a short line or two per card, which suits one idea per card;
- confirm these sizes on the measured player in the A1 pilot, on the smallest supported phone;
- nothing important in the bottom 15% of the frame, where native captions sit in Watch large;
- a 5% safe margin on every edge;
- contrast for any on-screen text at least 4.5:1 against what is behind it (the current menopause clip puts white captions on a pale background).

### Captions, transcript and audio description
- WCAG 2.2 1.2.2 requires captions for prerecorded audio. WCAG allows either open (burnt-in) or closed captions; Rhythme chooses checked WebVTT tracks (review), because burnt-in text cannot be turned off, resized, translated or searched, and it collides with native captions in fullscreen.
- Singapore's menopause guideline asks for culturally adapted, multilingual patient resources (E59, statement 12B). With WebVTT, Chinese, Malay and Tamil captions are a text job, not a re-render; plan them after the English set is approved.
- On-screen text and diagrams that carry information (thresholds, red flags, phone numbers, a cycle wheel) are also spoken. W3C notes that where all of the video information is already in the audio, no separate audio description is needed (E79), which is how 1.2.5 is meant to be met; the HTML transcript covers 1.2.3. Each finished film is checked against this, and the player is tested with a keyboard and VoiceOver (review).
- Loudness: measure Erin's clips and the app's other voice audio and match their integrated loudness within 1 LU, true peak at or below -1 dBTP, so moving from a film to a practice does not jump in volume.

### Hosting and size budget
- GitHub Pages caps a published site at 1 GB, with a soft bandwidth limit of 100 GB a month (T1); GitHub warns on files over 50 MiB and blocks files over 100 MiB (T2). The app is about 150 MB today. Every re-render committed to git stays in the repo history, so commit only approved final encodes.
- Size estimate, including both audio tracks (review); the pilot has since measured more (3.7 Mbit/s at 1080p, see Pilot result). Likely case, scaled from today's square clips (0.54 to 1.14 Mbit/s at 720 x 720 or 960 x 960, a quarter to a half of the 1080p pixel count): about 2 to 3 Mbit/s at 1080p and 1 to 1.5 Mbit/s at 720p, plus 0.128 Mbit/s audio in each file, so about 34 to 50 MB per 84-second film (the average) for both files, and about 0.9 to 1.35 GB for all 27. Worst case at the caps: about 77 MB per film and 2.1 GB in all.
- **Plan:** wave 1 (7 films, 610 s, likely 0.25 to 0.37 GB) can live in this repo. Before wave 2, encode the A1 pilot, measure it, and choose hosting from real numbers (review). A second Pages project has its own 1 GB, so it could hold the 720p files for every film (likely 0.32 to 0.46 GB) but probably not the 1080p files as well. The likely answer is object storage behind a CDN for the films (for example Cloudflare R2 with a custom domain, Bunny Stream or Mux), which costs money and so is Jamie's decision.
- GitHub's limits page also says Pages is not meant to host an online business or commercial SaaS. If Rhythme starts charging, that is a second reason to move the films (a policy note, not legal advice).
- The live site already serves `video/mp4` with `Accept-Ranges: bytes` and answers Range requests with 206 (T3); check that `.vtt` arrives as `text/vtt` after the first push.

### HLS: not needed for now
Progressive MP4 with faststart and Range requests is the starting point for 60 to 120 s films, subject to the pre-release startup and stall tests above. HLS would add a playlist and segment pipeline and, on browsers without native HLS, a player library. Reconsider adaptive delivery whenever the measurements call for it, or if a video host that provides it is adopted (review).

### Service worker change (must ship with the films)
`sw.js` treats every `.mp4` as cache-first media (`MEDIA`, line 6) and calls `cache.put` on whatever comes back (line 35). Browsers usually fetch video with Range requests; when the network answers 206, the Cache API rejects it with a TypeError (T7), so the cache does not fill. A full 200 response can be stored (review), and a stored full file then answers later Range requests without range handling, which Workbox says must be added explicitly (T5). Codex confirmed the code path (Gate D); a playback failure has not been reproduced. `.vtt` files already pass through, because neither regex matches them (review).

Fix: in the fetch handler, return early (no `respondWith`) for any `.mp4` URL, by extension rather than by folder, because pages controlled by this worker also send it requests for a future media host on the same origin (review). Offline video stays out of scope.

### Test before release
- Safari and Chrome on macOS, Safari on iPhone, Chrome on Android: play, seek to the end, Watch large, fullscreen in and out, captions on and off, Escape closes the theatre, focus returns.
- Network panel: the 720p file is used in the desk and the 1080p file in Watch large on a Retina Mac; Range requests are answered with 206 and seeking works; a plain 200 for the first request is also fine (review).
- Time to first frame and stalls measured on mobile data and on a Mac, before release.
- No console errors; `tools/e2e_smoke.py` gains one check that a Learn film loads metadata and has a caption track.

## App changes this plan implies (not made here)

1. **Now, before the friends launch:** remove menarche-v1 from `VIDEOS` and the Life chapters folder, and pull fertile-v4 (old brand plus the "pinpoint" claim). The Learn help text says "six little videos"; make it "short videos". Small, separate PR.
2. **With wave 1:** the in-desk player and Watch large theatre, the rendition picker, a caption line from the WebVTT cues, a "Transcript and sources" link, the service worker bypass for `assets/learn/`, and an `e2e_smoke.py` check.
3. **Before wave 2:** move the films to the hosting Jamie chooses (see the size budget) and point the film URLs there.
4. **Content notes:** the opt-in card for C1, C2 and C4, and a rule that those films never autoplay or appear as "next".
5. **Phase foods (Jamie's decision):** the diary's "Foods to try in this phase" and phase tips (`room.js` lines 146 and 943) are not supported by the evidence found here (E76, E77). Either reword them as general food ideas or keep them labelled as tradition, and only then make E2.
6. **Mindfulness ledger:** correct row L57 of `docs/research/2026-10-20-mindfulness/claim-ledger.md` (10 minutes daily for 3 days, E65).

## Limits of this review

- Abstracts only for most PubMed papers (marked in the ledger); full text for FIGO 2018 and 2023, the 2023 PCOS guideline, ESHRE endometriosis 2022 and pregnancy loss 2022, ASRM 2022, the two JMIR papers and the Singapore menopause consensus.
- The Singapore menopause consensus statements were read in full (6-page PDF); the launch release's Annex B symptom list was not.
- ACOG's 2026 guidelines on diagnosing endometriosis and on menopause symptoms, and the IMS 2025 recommendations, were seen as abstracts only; D2, D3 and A4 scripts should read them first.
- Several Singapore pages are undated (KKH, HealthHub PDFs); their check date is recorded instead.
- This is an evidence plan, not a clinical sign-off. Codex's reviews are editorial checks; wave 1 scripts, D3, C1 and C4 need a qualified clinician's review before render.
- Not every connecting sentence in the cards has its own ledger passage yet (the draft review named A2's physiology, B2 and C3 details); each script must trace every substantive sentence to a passage before review.
