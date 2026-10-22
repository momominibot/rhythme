# Codex read-only review, round one: recipes and the Mediterranean check

20 October 2026, `codex exec -s read-only -c tools.web_search=true` on af1b691. Verdict: NOT READY (8 should-fix, 2 nits). All were fixed in the next commit; see docs/design/2026-10-20-recipes.md.

## Prompt

```
You are reviewing one commit in the Rhythme PWA repository (current directory), read-only. Do not modify files. You may use web search to check sources.

Commit HEAD (af1b691): `git show HEAD`. Read ovu-recipes.js (data and scoring), the new functions openRecipes / openMedas / recSources / recCard / deskSpots in room.js, the evidence entries E107 to E116 in ovu-evidence.js, room.css and ovu-night.css additions, medas14.html (now a redirect stub), and the new test block recipesAndMedas in tools/test-core.js.

The feature: a Recipes sheet (PCOS/PMOS, Menopause, Everyday) linking to recipe pages by Jean Hailes and the Bone Health & Osteoporosis Foundation, with the source's own title and one line of ours per recipe, plus HealthHub guides; and a Mediterranean check (MEDAS from PREDIMED without its wine item: 13 items, Yes / Not yet, no grades, saved in OvuStore state.medas) that suggests recipes for "not yet" habits. It replaces the old medas14.html page.

Find real defects. For each: severity (blocker / should-fix / nit), file:line, the failing scenario, and the fix. In particular:
1. Facts: open the cited pages (each recipe URL and each E107-E116 source) and check that every title, every "why" line (ingredients), every group note and every evidence summary matches its source. Flag any overclaim about PCOS, menopause, fertility or ovaries, and any line unsafe in pregnancy or for people with eating disorders.
2. MEDAS fidelity: compare the 13 questions and hints with the 14 items and criteria of the published screener (Martinez-Gonzalez 2012 PLoS One Table 1; Schroder 2011 J Nutr).
3. Code: XSS (all text through esc?), listeners piling up on re-render, the yes / not-yet toggle and saving, the hash routes #medas and #recipes, the action routing (recipes:<group>), deskSpots collisions and edge cases (saved positions, more folders than cells), night-theme coverage, accessibility (aria-pressed, tablist roles, focus), and anything that breaks existing behaviour (the Nutrition folder, the old medas14.html link, privacy-local.js listing ovuluna_medas14).
4. Tests: do the new checks test what they claim?
End with one line: VERDICT: READY or VERDICT: NOT READY.
```

## Reply

Found eight should-fix issues and two nits. No files were modified.

1. **Should-fix | `ovu-recipes.js:39` | Unsupported week-long storage implication.**  
   “Makes enough for the week” can reasonably encourage keeping the bean salad for seven days. The [recipe](https://www.bonehealthandosteoporosis.org/wp-content/uploads/Four-Bean-Salad-1.pdf) specifies ten servings and immediate serving. [SFA](https://www.sfa.gov.sg/food-safety-tips/food-risk-concerns/risk-at-a-glance/bulk-cooking-clostridium-perfringens) advises eating refrigerated leftovers within 3–4 days, or one day for vulnerable people, including pregnant users. **Fix:** say “makes ten servings.”

2. **Should-fix | `ovu-recipes.js:20`; `tools/test-core.js:2368` | Menopause evidence overstated.**  
   “Food does not stop hot flushes” converts insufficient evidence into proof of no effect. The [position statement](https://menopause.org/wp-content/uploads/professional/2023-nonhormone-therapy-position-statement.pdf) concludes that evidence does not support recommending dietary modification as treatment. **Fix:** use that narrower conclusion and update the test, which currently requires the overstatement.

3. **Should-fix | `ovu-recipes.js:35,42` | Arbitrary dietary restrictions.**  
   “Rich, so a weekend dish” and “so a small bowl” impose unsupported frequency and portion rules, including on users recovering from eating disorders. Neither source prescribes these rules. The [PCOS guideline](https://doi.org/10.1016/j.fertnstert.2023.07.025) emphasizes individualized eating and avoiding unduly restrictive diets. **Fix:** retain the ingredient descriptions and remove both directives.

4. **Should-fix | `ovu-recipes.js:63` | MEDAS sweets category narrowed.**  
   Someone eating purchased custard daily, but no cakes, biscuits or pastries, can answer Yes. [Published Table 1](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0043134) explicitly includes commercial sweets, including custard. **Fix:** restore “commercial sweets or pastries, excluding homemade,” with representative examples.

5. **Should-fix | `room.js:1227` | Saved layouts cause overlapping folders.**  
   Reproduced with valid saved positions:
   `{cycle:[14,19], fertility:[64,19], chapters:[14,50], nutrition:[64,50]}`.  
   These exclude every candidate cell; the fallback places Recipes at `[2,35]`, overlapping existing folders. **Fix:** search additional positions using actual icon bounds or provide an overflow layout. Do not fall back to an occupied cell. The same fallback also cannot handle more folders than cells.

6. **Should-fix | `room.js:2925`; `medas14.html:2` | Redirect destination lost for first-time room users.**  
   A legacy user opening `medas14.html` reaches `#medas`, but the welcome branch runs instead. The hash is erased, and Skip/onboarding never resumes the check. Reproduced with the actual boot branch and welcome handlers. **Fix:** preserve the pending destination and dispatch it after consent/onboarding. This also affects first-launch `#recipes`.

7. **Should-fix | `room.js:2314,2319,2321` | Failed saves leave misleading in-memory answers.**  
   With storage full, `S.setState()` mutates memory and then throws. Painting stops without an error message; reopening shows the answer, while reloading loses it. Reproduced using the real store with quota failures. **Fix:** build immutable answer snapshots, save through `S.commit()`, and catch failures with rollback and a visible message. Apply this to Clear too; merely replacing `setState` is insufficient because `ans` currently aliases stored answers.

8. **Should-fix | `room.css:1805`; `ovu-night.css:150` | Selected Yes text fails contrast.**  
   White 12px text measures **2.77:1** by day and **3.21:1** at night, below the [4.5:1 requirement](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html). **Fix:** darken the green backgrounds or use sufficiently dark text.

9. **Nit | `room.js:2277,2283` | Recipe tabs lose focus and lack tab behavior.**  
   Activating Menopause or Everyday rebuilds the sheet; desktop focus returns to PCOS through `openSheet()`. Arrow navigation, roving tabindex and tab-panel relationships are absent. **Fix:** preserve focus on the selected tab and implement the [tabs pattern](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/), or use ordinary filter buttons without tab roles.

10. **Nit | `ovu-recipes.js:65` | Rabbit omitted from MEDAS.**  
    A user preferring rabbit over red/processed meat satisfies the published criterion but cannot accurately answer this version. **Fix:** include rabbit alongside chicken and turkey. [Table 1](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0043134)

`node tools/test-core.js` passed **922 checks**. However, all 12 new checks also passed an in-memory mutation changing vegetables to **20 servings daily** and pointing a recipe at a nonexistent path. They verify data structure, selected strings and pure scoring, not source fidelity, link availability or UI behavior. Add behavioral coverage for saving, clearing, routing, desk allocation and focus.

The remaining recipe titles and ingredient descriptions matched retrieved source text; chicken and carrots required indexed first-party text because direct requests returned errors. E107–E116 summaries matched their primary sources. No listener accumulation or exploitable XSS was found in the new rendering paths. Normal toggling, `aria-pressed` updates and action routing are consistent. Retaining `ovuluna_medas14` for historical privacy controls is appropriate; current answers participate in the main store’s export/deletion.

VERDICT: NOT READY

