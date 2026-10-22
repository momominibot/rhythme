You are reviewing the scoring formulas for Rhythme, a women's health diary app (adults, Singapore). Work read-only; use web search to open primary sources. Output Markdown.

The owner asked (22 Oct 2026): "for cycle tab - i want graphing and a cycle wellness scoring + circadian cycle scoring (need you to figure out the formulae to derive the scores)". An earlier design (docs/design/2026-10-18-cycle-wellness-score.md and docs/design/2026-10-21-cycle-tab-rhythm.md in the repo at the working directory) chose no composite number; the owner now explicitly wants scores. Your job: make the formulas as defensible as possible, not argue against having them.

Proposed:

CYCLE WELLNESS SCORE (0-100). Needs at least 3 completed cycle intervals in the last 6 months (confirmed periods only; gaps over 60 days are breaks, not cycles). Components, each 0-100, weights renormalised over the components that have data:
- Regularity (35%): range = longest minus shortest of the last up to 6 intervals; V = FIGO 2018 normal variation by age (7 days for 26-41, 9 for 18-25 and 42-45, 7 if age unknown). Score 100 if range <= V, falling linearly to 0 at range >= V + 13.
- Frequency (25%): share of intervals within 24-38 days (FIGO 2018), times 100.
- Period length (15%): share of periods lasting 8 days or less (FIGO), times 100.
- Comfort (25%): 100 minus 100 x (period days with cramps or period pain logged / period days with a symptom answer); only when 5 or more period days have a symptom answer.
Bands: 80-100 "Steady", 60-79 "Mostly steady", 40-59 "Variable", below 40 "Worth a chat". Postmenopausal, pregnant, or no periods expected: no score.

CIRCADIAN RHYTHM SCORE (0-100). Last 14 days, needs at least 7 nights with bedtime and wake time:
- Steady timing (40%): circular SD of sleep midpoint; 100 if SD <= 30 min, 0 if >= 120 min, linear between.
- Enough sleep (30%): share of nights 7 to 9 hours (AASM/SRS 2015: 7+ for adults; NSF 7-9).
- Steady waking (15%): SD of wake time; 100 if <= 30 min, 0 if >= 90 min.
- Weekday vs weekend (15%): absolute difference between mean midpoint on Fri/Sat nights and other nights (social jet lag, Wittmann 2006); 100 if <= 30 min, 0 if >= 120 min; needs 2+ of each.
Bands as above but the lowest is "Very variable".

Please:
1. For each component and threshold, find the best primary source (paper or guideline), say whether the threshold is supported, adapted, or arbitrary, and propose a better-supported threshold or form where one exists (for example the Sleep Regularity Index, Phillips 2017 and Windred 2024; FIGO 2018 Munro).
2. Check weights for face validity; propose changes with reasons.
3. Safety: anything here that could mislead (e.g. a high score hiding a red flag, PMOS/PCOS, heavy bleeding, perimenopause), and how the UI must word it. Care prompts must never depend on the score.
4. Minimum data rules and how to show "not enough data".
5. Give the final formulas as pseudo-code I can implement directly.
Be concise and concrete.
