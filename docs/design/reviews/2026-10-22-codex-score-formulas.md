**Use both scores as transparent, app-defined diary indices.** The evidence supports several reference ranges, but does not validate these composites, weights or score bands. Your new request supersedes the earlier decision against scores.

My recommendation: **cycle weights 25/25/20/30; sleep weights 70/30; fixed components without silent renormalisation.**

**1. Components and thresholds**

| Cycle component | Evidence verdict | Recommended treatment |
|---|---|---|
| Regularity | **Supported:** shortest-to-longest range; V = 9 days at 18–25 and 42–45, 7 at 26–41. **Arbitrary:** the linear decline and zero at V+13. | Keep the smooth curve as an explicitly app-defined mapping. Separately show whether the FIGO reference is met. Unknown age must not default to 7; norms after 45 are insufficiently defined. [FIGO 2018](https://obgyn.onlinelibrary.wiley.com/doi/10.1002/ijgo.12666) |
| Frequency | **Supported:** 24–38 days inclusive. **Adapted:** percentage of intervals meeting that reference. | Keep. Show individual lengths alongside the percentage. [FIGO 2018](https://obgyn.onlinelibrary.wiley.com/doi/10.1002/ijgo.12666) |
| Period length | **Supported:** up to 8 consecutive bleeding days, including light bleeding/spotting within the episode. **Adapted:** percentage meeting the reference. | Keep, using confirmed episode boundaries. Five recorded bleeding dates do not necessarily establish a five-day period. [FIGO 2023](https://obgyn.onlinelibrary.wiley.com/doi/10.1002/ijgo.14946) |
| Comfort | The proposed formula measures **pain-free answered days**, treating mild cramps and disabling pain equally. Its five-day minimum is **arbitrary**. | Prefer explicit **average menstrual pain today, 0–10**. Reverse-scale its mean to 0–100, averaging each period equally. The pain scale has primary measurement evidence; this reverse-scoring and aggregation remain app-defined. [Chen et al., 2025](https://www.frontiersin.org/journals/pain-research/articles/10.3389/fpain.2025.1655464/full) |

Use the preceding **six calendar months**, consistent with FIGO’s current application, and all eligible intervals within that window. Limiting this to the last six intervals is another adaptation and can omit frequent cycles. [FIGO 2023](https://obgyn.onlinelibrary.wiley.com/doi/10.1002/ijgo.14946)

**Correct the 60-day rule:** an *unknown logging gap* is a break; a *confirmed absence of intervening periods* is meaningful long-cycle data. Preserve confirmed long intervals for frequency, regularity and care assessment, even if prediction code treats them as breaks. Otherwise the score selectively removes its most irregular observations.

| Sleep component | Evidence verdict | Recommended treatment |
|---|---|---|
| Midpoint circular SD; 30–120-minute ramp | SD is an established descriptive measure. **Neither scoring anchor is clinically validated.** | Keep this disclosed app mapping for the diary version. [Fischer et al., 2021](https://pmc.ncbi.nlm.nih.gov/articles/PMC8503839/) |
| Nights with 7–9 hours | **Supported reference range**, but an overly rigid pass/fail rule. NSF recommends 7–9 hours at 18–64 and 7–8 at 65+. AASM/SRS recommends ≥7 and explicitly allows circumstances where >9 is appropriate. | Score **share meeting the seven-hour minimum**; do not automatically penalise >9. Label it “7-hour minimum met”, rather than “healthy sleep achieved”. [NSF 2015](https://doi.org/10.1016/j.sleh.2015.10.004), [AASM/SRS 2015](https://aasm.org/resources/pdf/adultsleepdurationconsensus.pdf) |
| Wake-time SD; 30–90-minute ramp | Descriptive measure supported; anchors **arbitrary**. | Show circular SD in minutes, outside the composite. It substantially overlaps midpoint variability. |
| Fri/Sat versus other nights; 30–120-minute ramp | Social jetlag compares **free days with work/obligation days**. Fri/Sat is only a schedule assumption. Anchors and two-per-group minimum are **app choices**. | Classify by the following waking day’s actual obligations. Show the circular midpoint difference outside the composite. [Wittmann 2006](https://schoolstarttime.org/wp-content/uploads/2011/05/wittmann-dinich-merrow-roenneberg-social-jetlag-misalignment-of-biological-and-social-time.pdf) |

**SRI is a stronger established alternative when the inputs support it:**

```text
SRI = 200 × P(same sleep/wake state at t and t+24h) − 100
```

Its theoretical range is −100 to 100. It needs observed sleep/wake states, including naps and awakenings. Phillips used detailed diaries; bedtime and waking alone cannot establish the complete signal. [Phillips 2017](https://www.nature.com/articles/s41598-017-03171-4), [Fischer 2021](https://pmc.ncbi.nlm.nih.gov/articles/PMC8503839/)

Windred supports SRI’s observational relevance, but does **not** validate this composite or its use as an individual health-risk score for Singapore women. Its analysis required at least 120 hours of valid 24-hour-separated epoch pairs. Missing days must never be bridged as adjacent days. [Windred 2024](https://academic.oup.com/sleep/article/47/1/zsad253/7280269)

**2. Weights and bands**

- **Cycle: 25% regularity, 25% frequency, 20% bleeding duration, 30% comfort.** This reduces overlapping timing measures from 60% to 50% and gives symptoms slightly more influence. These are provisional product weights, without evidence establishing an optimal allocation.
- **Sleep: 70% midpoint consistency, 30% duration.** This preserves the proposal’s overall emphasis on timing while avoiding counting related timing variation three times.
- **Require all components for the full score.** Show available components while others are missing. Silent renormalisation can make a score fall simply because symptom logging becomes available.
- **Remove the verbal bands initially.** The 80/60/40 boundaries have no validated meaning. “Worth a chat” must be an independent care message; “Steady” poorly describes a composite containing pain or sleep duration.

**3. Minimum data and missingness**

These are **app sufficiency rules**, not validated precision guarantees.

| Score | Recommended minimum |
|---|---|
| Cycle | Three completed, confirmed consecutive intervals, requiring four starts; three corresponding completed bleeding episodes; same reproductive/treatment context. For comfort, ≥5 explicit daily pain answers overall and ≥80% coverage **within each scored period**. |
| Sleep | Ten valid timing observations and ten actual-sleep-duration observations within 14 completed local dates, with ≥4 observations in each seven-day half for each component. Seven nights can overstate consistency; the exact ten-night choice remains pragmatic. [Fischer 2021](https://pmc.ncbi.nlm.nih.gov/articles/PMC8503839/) |

Additional rules:

- Missing is `null`; explicit “no pain” is zero. A generic symptom entry does not establish pain absence.
- Deduplicate dates and overlapping imports. Exclude assumed/autofilled times, unresolved conflicting records and future observations.
- Use estimated **sleep onset and final waking** for timing. Bedtime-to-waking is time in bed; duration needs an actual-sleep estimate.
- Preserve explicit “no sleep” as zero duration, rather than discarding it.
- Pregnancy, postpartum recovery, hormonal-treatment changes and unresolved logging gaps start separate contexts.
- Unknown age needs an optional matching age band. Above 45, show available component scores and graphs without inventing a FIGO regularity threshold.
- Display `—`, never `0`, for insufficient data: **“2 of 3 confirmed intervals available. Comfort answers cover 6 of 15 period days.”**

**4. Safety and required wording**

**Care checks run before, and independently of, every score calculation, including when the score is null.**

- **Heavy bleeding can coexist with excellent timing and short periods.** Ask separately about flooding, disruption, clots, overnight protection changes and anaemia symptoms. Significant abdominal pain or heavy vaginal bleeding needs immediate assessment, consistent with KKH guidance. [SingHealth](https://www.singhealth.com.sg/symptoms-treatments/menorrhagia-heavy-menstruation), [KKH urgent care](https://www.kkh.com.sg/our-specialties/urgent-og-centre)
- **FIGO frequency is not a PMOS screen.** Consistent 36–38-day cycles could earn full frequency points while meeting the international guideline’s >35-day assessment criterion. Regular cycles do not establish ovulation. Also assess prolonged absence and relevant symptoms independently. [International guideline, recommendations 1.1.1 and 1.1.5](https://pmc.ncbi.nlm.nih.gov/articles/PMC10477934/)
- **Perimenopause is context, not failed wellness.** Do not extrapolate age thresholds after 45 or interpret changing cycles as proof of disease. Any postmenopausal bleeding requires assessment. [FIGO 2023](https://obgyn.onlinelibrary.wiley.com/doi/10.1002/ijgo.14946), [KKH menstrual guidance](https://www.kkh.com.sg/wise/menstrual-problems)
- **Completed-cycle scores can become stale during a current long interval.** Always show the score’s dates and days since the latest confirmed period.
- **High sleep scores cannot rule out insomnia, sleep apnoea or inadequate sleep.** Perfectly consistent four-hour nights would score 70 under the recommended arithmetic formula. Therefore always display duration beside the total and avoid green “healthy/all clear” treatment.
- Do not grade hormonal withdrawal bleeding as spontaneous-cycle regularity. For fragmented/polyphasic sleep, explain the main-sleep metric’s limitations rather than implying measured circadian alignment.

Suggested permanent copy:

> **Cycle Wellness Score:** “An app-defined summary of your recorded cycle patterns and menstrual pain. It does not assess fertility, confirm ovulation or rule out a health condition.”

> **Circadian Rhythm Score:** “Estimated from your recorded sleep schedule and duration. It does not measure your internal body clock.”

**5. Implementable formulas**

All ramps, weights and coverage rules below are **Rhythme v1 choices**.

```text
clamp01(x):
    return min(1, max(0, x))

descendingScore(value, fullAt, zeroAt):
    return 100 * clamp01((zeroAt - value) / (zeroAt - fullAt))

percentage(values, predicate):
    return 100 * count(values matching predicate) / count(values)

ageVariationLimit(age):
    if 18 <= age <= 25: return 9
    if 26 <= age <= 41: return 7
    if 42 <= age <= 45: return 9
    return null

circularStats(clockMinutes):
    angles = clockMinutes * 2*pi/1440
    C = mean(cos(angles))
    S = mean(sin(angles))
    resultant = min(1, hypot(C, S))

    if resultant <= 1e-12:
        return {mean: null, sd: Infinity}

    return {
        mean: (atan2(S, C) * 1440/(2*pi)) modulo 1440,
        sd: sqrt(-2*ln(resultant)) * 1440/(2*pi)
    }

circularDistance(a, b):
    difference = abs(a-b) modulo 1440
    return min(difference, 1440-difference)
```

```text
cycleScore(today, context, records):
    care = evaluateIndependentCareRules(records, context, today)

    if pregnant OR postmenopausal OR periodsNotExpected:
        return {score: null, status: "not_applicable", care}

    if postpartumRecovery OR treatmentControlledBleeding:
        return {score: null, status: "different_context", care}

    # Calendar-month arithmetic, never 6*30 days.
    windowStart = today minus 6 calendar months

    # Latest adequately recorded segment in the current context.
    # Unknown intervening-period gaps split segments.
    # Confirmed long intervals, including >60 days, remain included.
    I = confirmed consecutive start-to-start intervals
        with both starts inside [windowStart, today]
        in the latest segment

    # Corresponding bleeding episodes at each interval's starting date.
    P = period episodes associated with I
    V = ageVariationLimit(context.age)

    components = {regularity: null, frequency: null,
                  duration: null, comfort: null}

    if count(I) >= 3:
        lengths = calendarDayDifferences(I)

        if V != null:
            spread = max(lengths) - min(lengths)
            components.regularity =
                descendingScore(spread, V, V+13)

        components.frequency =
            percentage(lengths, length => 24 <= length <= 38)

    if count(P) >= 3 AND every P has confirmed complete boundaries:
        bleedingDays = P.map(endDate - startDate + 1)
        components.duration =
            percentage(bleedingDays, days => days <= 8)

        # One explicit DAILY AVERAGE menstrual-pain answer per date.
        # Missing answers remain missing; explicit no pain = 0.
        if every P has pain coverage >= 0.80
           AND total explicit pain answers >= 5:
            periodMeans = P.map(
                mean(explicit daily average menstrual pain, 0..10)
            )
            components.comfort = 100 - 10*mean(periodMeans)

    if any component is null:
        return {score: null, status: "needs_data_or_context",
                components, denominators, care}

    total = 0.25*regularity + 0.25*frequency
          + 0.20*duration   + 0.30*comfort

    return {score: round(total), components, denominators,
            windowStart, today, version: "cycle-v1", care}
```

```text
sleepScore(today, records):
    care = evaluateIndependentSleepCareRules(records, today)
    dates = last 14 completed local sleep dates

    T = deduplicated confirmed main-sleep onset/final-wake records
        on dates, excluding assumed times
    D = deduplicated actual-sleep-duration observations on dates
        # Include explicit no-sleep observations as zero.

    covered(X):
        return count(X) >= 10
           AND count(X in first 7 dates) >= 4
           AND count(X in last 7 dates) >= 4

    if not covered(T) OR not covered(D):
        return {score: null, status: "needs_data",
                timingCoverage: count(T), durationCoverage: count(D),
                care}

    midpoints = T.map(
        localClockMinutes(onset + (finalWake-onset)/2)
    )
    midpointSD = circularStats(midpoints).sd

    timing = descendingScore(midpointSD, 30, 120)
    duration = percentage(D, actualSleepMinutes => actualSleepMinutes >= 420)
    total = 0.70*timing + 0.30*duration

    wakeSD = circularStats(T.finalWakeClockMinutes).sd

    free = T classified by genuinely free waking mornings
    obligation = T classified by work/obligation waking mornings
    socialJetlag = null

    if count(free) >= 2 AND count(obligation) >= 2:
        freeMean = circularStats(free.midpoints).mean
        obligationMean = circularStats(obligation.midpoints).mean
        if both means are defined:
            socialJetlag = circularDistance(freeMean, obligationMean)

    return {score: round(total), timing, duration,
            midpointSD, wakeSD, socialJetlag,
            coverage, version: "sleep-diary-v1", care}
```

Return raw values, denominators, dates and formula version with every score. Do not join diary and future SRI scores into one uninterrupted trend or interpret small score changes as clinically meaningful.

Read-only review completed; no repository files changed.

