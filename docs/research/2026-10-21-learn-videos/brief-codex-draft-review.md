# Draft review: Rhythme Learn videos plan (find the errors)

You are reviewing a finished draft, read-only, with web search. Today is 20 October 2026. Your job is to find what is wrong, not to praise it. Read these files in this repository:

- docs/research/2026-10-21-learn-videos-gold-drop.md (the draft plan)
- docs/research/2026-10-21-learn-videos/ledger.md (the evidence ledger every claim should trace to)
- docs/research/2026-10-21-learn-videos/codex-gate-d.md (your own earlier Gate D findings, made before the draft existed)
- room.js, room.css and sw.js where the draft makes claims about the app

Context: Rhythme is an 18+ women's health PWA for Singapore first (cycle health, trying to conceive, after pregnancy including loss, perimenopause, after menopause). The plan proposes 27 short educational films (60 to 120 s), a desktop streaming spec, and a production plan that Jamie (the owner) must approve. Rules: no diagnosis claims, urgent-care lines in every clinical film, no guaranteed outcomes, Singapore sources first, primary sources only, no em dashes anywhere.

Check, and report every problem you find:
1. **Traceability.** Any key message, number, threshold or red-flag line in a film card that is not supported by the ledger row it cites, or cites no row, or overstates the row (wrong number, wrong population, wrong denominator, abstract-only evidence used for a strong claim).
2. **Safety.** Any red-flag or see-a-doctor line that could delay care, falsely reassure, or send someone to an emergency department needlessly; any inconsistency between F1 and the other cards; anything that contradicts your Gate D findings or that dropped one of them.
3. **Singapore fit.** Any UK or US rule presented as if it applied in Singapore; any Singapore fact that is wrong or out of date (numbers, services, ages, screening intervals, emergency and helpline numbers).
4. **Internal consistency.** Contradictions between cards (for example cycle-length thresholds in A1 vs A5), between the summary and the cards, or between the film table (count, waves, runtimes) and the cards.
5. **Streaming spec.** Errors in the encoding settings, size estimates, GitHub Pages limits, the service worker analysis, rendition selection, caption and WCAG statements, or claims about room.css and sw.js line numbers and behaviour.
6. **Overclaims and tone.** Promotional drift, absolute words ("always", "never", "safe"), and any claim the app makes about itself that the live code does not support.
7. **Em dashes.** Any em dash character in the draft or ledger.

Return a numbered list, most serious first. For each: severity (must fix / should fix / nit), the exact location (section and card ID or line), the problem, the evidence (ledger row, URL with date and a short quote, or file and line), and the exact replacement wording you recommend. End with a one-line verdict: ready to publish as a research plan, ready after the must-fix items, or not ready. Keep it under about 2,000 words.
