<!-- Codex read-only review, round two, 20 October 2026 (gpt-6.1-sol, web search on), of 71efce0 and the whole feature. Prompt: the round-two brief in the design note. -->

Eight round-one findings are fixed. Two remain: the menopause claim and saved-layout collisions. I also found a new route race and an unsafe simplification in E118.

I reviewed `71efce0` and the complete feature diff. `node tools/test-core.js` passed **927 checks**. Reproductions and mutations below ran entirely in memory. No files were modified. I inspected the browser tests but did not run the full suite, which writes a temporary PDF into the repository.

| Round-one finding | Result | Evidence and traced scenario |
|---|---|---|
| 1. Week-long salad storage implication, should-fix | **FIXED** | `ovu-recipes.js:39` now says ten servings, matching the [recipe’s yield](https://www.bonehealthandosteoporosis.org/wp-content/uploads/Four-Bean-Salad-1.pdf). No storage duration is implied. |
| 2. Menopause evidence overstated, should-fix | **NOT FIXED** | `ovu-recipes.js:20` still says no food or diet change “has been shown” to ease flushes. See finding 1 below. |
| 3. Unsupported portion/frequency restrictions, should-fix | **FIXED** | `ovu-recipes.js:35` and `:42` remove “weekend dish” and “small bowl.” Opening either card now gives ingredients without those restrictions. |
| 4. MEDAS commercial sweets narrowed, should-fix | **FIXED** | `ovu-recipes.js:63` includes commercial sweets, excludes homemade, and names custard. Daily purchased custard now clearly prevents Yes. |
| 5. Saved-layout collisions, should-fix | **NOT FIXED** | `room.js:1232` still deliberately selects an overlapping fallback. Exact reproduction below. |
| 6. First-visit destination lost, should-fix | **FIXED**, with a new race | `room.js:2946` retains the destination; `:2765` consumes it after Skip; `:2751` consumes it after completed onboarding. Intermediate onboarding sheets do not consume it. See finding 4. |
| 7. Failed saves leave misleading answers, should-fix | **FIXED** | `room.js:2298`, `:2324`, `:2330`, `:2334` copy answers and use `S.commit()`. With quota failures, both answer changes and Clear preserve previous memory, persisted bytes and reload state, while showing the error toast. |
| 8. Selected Yes contrast, should-fix | **FIXED** | `room.css:1818` and `ovu-night.css:160` use white on `#3a7559`: **5.43:1** in both themes. Selected night rules beat the generic button rule. |
| 9. Filters lose focus/incomplete tabs, nit | **FIXED** | `room.js:2282` uses ordinary `aria-pressed` buttons; `:2291` restores focus to the selected filter after rebuilding. The synchronous focus in `openSheet()` happens first. |
| 10. Rabbit omitted, nit | **FIXED** | `ovu-recipes.js:65` includes rabbit. Someone preferring rabbit can now answer consistently with [Table 1](https://journals.plos.org/plosone/article/file?id=10.1371/journal.pone.0043134&type=printable). |

1. **Should-fix | `ovu-recipes.js:20`; `tools/test-core.js:2370` | Menopause wording still exceeds the evidence.**

   The revised opening denies that any dietary benefit has been demonstrated. The cited statement actually discusses a positive randomized dietary trial, then concludes that the overall evidence is insufficient to recommend dietary modification. Those are different claims. The test now requires the new overstatement.

   **Fix:** “The Menopause Society’s 2023 review found insufficient evidence to recommend dietary changes or soy for treating hot flushes.” Keep the clinician-treatment sentence. Update the test accordingly. [2023 position statement, dietary modification section](https://menopause.org/wp-content/uploads/professional/2023-nonhormone-therapy-position-statement.pdf)

2. **Should-fix | [room.js:1232](room.js:1232); `room.css:675` | Saved layouts still overlap.**

   Running the actual `deskSpots()` with the requested saved positions and ten folders returned:

   ```text
   recipes [32,4]   mind [32,28]    move [32,52]
   body    [47,4]   videos [47,24]  doctor [47,44]
   ```

   There are **ten collisions even under the function’s own 18 × 24 approximation**. Recipes/Body are only 15 units apart horizontally; Body/Videos share x and are only 20 apart vertically. The actual buttons are also **22% wide**, exceeding the assumed 18%.

   **Fix:** use actual button bounds and an overflow arrangement when the remaining space cannot fit folders. Never substitute “least crowded” for collision-free placement.

3. **Should-fix | [ovu-evidence.js:109](ovu-evidence.js:109) | E118 incorrectly clears all pasteurised soft cheeses.**

   A pregnant reader consulting E118 could conclude that cold pasteurised brie or blue cheese is safe. NHS explicitly retains cooking requirements for mould-ripened and soft blue cheeses, including pasteurised ones.

   **Fix:** distinguish the permitted pasteurised soft cheeses from mould-ripened/blue cheeses requiring thorough cooking. The actual recipe-sheet pregnancy line at `ovu-recipes.js:73` is conservative on cooking and does not contain this same exemption. [NHS pregnancy food guidance](https://www.nhs.uk/pregnancy/keeping-well/foods-to-avoid/)

4. **Should-fix, new regression | [room.js:2761](room.js:2761) | Pending navigation can overwrite a newly opened sheet.**

   `takePending()` clears the pending value correctly, but schedules an unconditional destination opening **700 ms later**. After welcome Skip, tapping Cycle during that interval opens the calendar, which the timer then replaces. Reopening onboarding through Window → intro has the same problem. The extracted actual functions reproduced:

   ```text
   onboarding opened → delayed medas opened over it
   ```

   **Fix:** dispatch synchronously after completion, or cancel the scheduled hand-off when another sheet takes ownership.

   The ordinary paths otherwise trace correctly: two consumption calls schedule one destination; an empty-hash boot schedules none; Begin does not dispatch before completion; onboarding’s urgent card does not trigger dispatch.

5. **Should-fix | `tools/test-core.js:2375`, `:2381`, `:2399`; `tools/e2e_smoke.py:1698` | Tests still permit material regressions.**

   I executed all **16 `recipesAndMedas` checks** separately for each mutation:

   | In-memory mutation | Result |
   |---|---|
   | “4 tablespoons” → “24 tablespoons” | 16 passed |
   | Replace butter with a duplicate olive-oil item | 16 passed |
   | Replace a recipe path with a nonexistent path | 16 passed |

   The threshold regex matches substrings; MEDAS IDs are not checked for exact unique coverage. The saved-layout assertion checks only the first three additions against saved folders, then merely prohibits identical coordinates.

   The browser block checks successful persistence, Clear and filter focus. Its first-visit fixture already has consent and tests **Skip only**. Removing the completion hand-off or removing pending-value clearing would leave that test green. Card checks inspect attributes, without establishing destination availability.

   **Fix:** exact item-set assertions, bounded threshold checks, all-pairs rectangle checks, and behavioral coverage for quota failure, Begin/completion, intermediate sheets, competing navigation, ordinary boot and repeated consumption. Describe link-attribute coverage separately from source availability.

6. **Should-fix, newly noticed but predates this fixes commit | `room.css:1815` | Essential hints remain too faint.**

   Serving-size and context hints use 11px `#9a8cb3` on white: **3.10:1**. These include information needed to answer MEDAS correctly.

   **Fix:** use the existing secondary ink, which measures **5.69:1** on white, or another passing colour. The selected Yes repair itself is sound. [WCAG contrast requirement](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)

7. **Nit | `ovu-recipes.js:60`, `:62` | Two MEDAS details still drift.**

   “Packet drinks all count” includes unsweetened, noncarbonated drinks outside the published category. The shellfish hint also omits Table 1’s alternative of **4–5 units**.

   **Fix:** say “sweetened packet drinks”; restore the shellfish alternative. The other retained questions and thresholds match the table in substance. [Published Table 1](https://journals.plos.org/plosone/article/file?id=10.1371/journal.pone.0043134&type=printable)

The other requested copy checks were largely sound:

- **PCOS doctor line, `ovu-recipes.js:18`:** appropriate. Metabolic and cardiovascular assessment belongs in PCOS care; the sentence does not diagnose from symptoms. [International guideline](https://www.asrm.org/practice-guidance/practice-committee-documents/recommendations-from-the-2023-international-evidence-based-guideline-for-the-assessment-and-management-of-polyendocrine-metabolic-ovarian-syndrome-2023/)
- **Plant iron, `:42`:** accurate and appropriately avoids presenting granola as treatment for heavy bleeding. The [source recipe](https://www.jeanhailes.org.au/recipes/iron-rich-granola/) supports the ingredient description.
- **Calcium sulphate and soft bones, `:33`, `:29`, `:36`:** supported, with the important conditions now explicit. [NIH calcium reference](https://ods.od.nih.gov/factsheets/calcium-HealthProfessional/), [salmon recipe](https://www.bonehealthandosteoporosis.org/wp-content/uploads/Recipe-for-Gingered-Salmon-Croquettes.pdf)
- **“Not that score,” `:69`:** correctly distinguishes this adaptation from validated MEDAS and describes associations rather than effects. [Validation study](https://pubmed.ncbi.nlm.nih.gov/21508208/)
- **Care/eating-disorder wording, `:74`:** reasonable individualisation, without reinstating arbitrary restrictions. The skip invitation and removal of portion rules improve this.
- **Kopi-o/teh-o kosong, `:71`:** the unsweetened examples are appropriate. **Nit:** when recommending these to pregnant users, add the caffeine qualification. A drinks-only recommendation currently renders no pregnancy note because `room.js:2320` requires recipe ideas. [NHS specifies a 200 mg daily caffeine limit](https://www.nhs.uk/pregnancy/keeping-well/foods-to-avoid/).

On the design note’s “Not taken” decisions:

- **PMOS rejection:** correctly rejected. The [2026 Lancet consensus](https://pubmed.ncbi.nlm.nih.gov/42119588/) supports the rename. **Nit at `ovu-evidence.js:108` and `docs/design/2026-10-20-recipes.md:88`:** the paper describes a **three-year transition** and separately a **2028 guideline update**, not a defined transition ending in 2028. Keep those statements separate. [Full paper, implementation stages](https://storagehub.homnya.net/cmsimage/2026/05/polyendocrine-metabolic-ovarian-syndrome-the-new-name-for-polycystic-ovary-syndrome_-a-multistep-global-consensus-process.pdf)
- **Keeping carbonated drinks and olive oil:** agree. Changing either criterion would further alter the instrument. **Keeping 200 g shellfish:** also correct, subject to restoring the alternative noted above. [Table 1](https://journals.plos.org/plosone/article/file?id=10.1371/journal.pone.0043134&type=printable)
- **One pregnancy notice instead of per-card warnings:** reasonable design choice. It needs accurate content and coverage of the drinks-only path; repeating it on every card is unnecessary.
- **Omitting a folic-acid dose:** safe with the pharmacist referral, but the evidence-access reason is now outdated. **Nit at `docs/design/2026-10-20-recipes.md:94`:** current NHS guidance explicitly gives **400 micrograms daily**, with higher doses for some people. Either retain the referral as a deliberate choice or add the sourced usual dose with its exception. [NHS supplements guidance](https://www.nhs.uk/pregnancy/keeping-well/pregnancy-vitamins-and-supplements/)

No new listener accumulation or XSS path was found. `openSheet()` replaces the body node at `room.js:548`; handlers attach to fresh elements. MEDAS repaint replaces recommendation links only. The redirect stub’s JavaScript, refresh and fallback link consistently target `room.html#medas`.

VERDICT: NOT READY

