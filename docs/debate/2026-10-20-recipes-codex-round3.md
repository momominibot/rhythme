<!-- Codex read-only review, round three, 21 October 2026 (gpt-6.1-sol, web search on), of 52a650a and the whole feature. -->

Reviewed `52a650a` against both requested bases. **One P2 remains: the new Recipes desk entry cannot be opened with a keyboard.** No P1 health-copy defect found. No files modified.

`node tools/test-core.js`: **1,028 passed, 0 failed**. The isolated `recipesAndMedas` block passed **24/24**. I inspected the browser tests but did not run the full runner because it writes `tools/.smoke.pdf`.

The round-two findings:

| # | Result | Evidence |
|---|---|---|
| 1. Menopause wording | **FIXED** | `ovu-recipes.js:20` now describes insufficient evidence to recommend dietary changes, matching the [2023 statement](https://menopause.org/wp-content/uploads/professional/2023-nonhormone-therapy-position-statement.pdf). |
| 2. Saved-layout collisions | **NOT FIXED completely, P3 residual** | The original crowded-layout reproduction now tidies correctly. The remaining 32%-tall-name case below escapes `H=30`. |
| 3. E118 soft cheeses | **FIXED** | `ovu-evidence.js:109` preserves cooking requirements for pasteurised mould-ripened and soft blue cheeses, matching [NHS guidance](https://www.nhs.uk/pregnancy/keeping-well/foods-to-avoid/). |
| 4. Pending-route timer race | **FIXED** | `room.js:2788` clears and opens synchronously. Completion consumes after `onb=null`; Skip consumes immediately. Rare abandonment paths remain below. |
| 5. Test weaknesses | **NOT FIXED completely, P3** | The original three mutations are caught. Coordinate persistence and some navigation behavior still escape coverage. |
| 6. Faint hints | **FIXED** | `room.css:1828` uses secondary ink, approximately 5.7:1 on white. `ovu-night.css:158` supplies the brighter night colour. |
| 7. MEDAS wording nits | **FIXED** | `ovu-recipes.js:60` specifies sweetened packets; `:62` restores the shellfish alternative. Both match [Table 1](https://journals.plos.org/plosone/article/file?id=10.1371/journal.pone.0043134&type=printable). |

The additional nits:

- **Caffeine: FIXED.** `ovu-recipes.js:71` carries the pregnancy qualification within the drinks suggestion, including when no recipes render.
- **Folic acid: FIXED.** `ovu-recipes.js:22` and E115 at `ovu-evidence.js:106` match the [NHS dose, timing and higher-dose exception](https://www.nhs.uk/pregnancy/keeping-well/pregnancy-vitamins-and-supplements/).
- **E117 transition: FIXED in runtime copy.** `ovu-evidence.js:108` matches the [Lancet abstract](https://pubmed.ncbi.nlm.nih.gov/42119588/) without inventing a 2028 transition end. The old design-note sentence remains.
- The earlier filter-focus, rabbit, commercial-sweets, atomic-save and selected-Yes fixes remain intact.

Remaining findings, ranked:

1. **P2 | `room.js:1266`, `:1285`, `:1323` | Keyboard activation cannot open Recipes or Nutrition.**

   Folder opening happens only through `pointerup → endDrag()`. Enter, Space and assistive activation produce a click, but the click handler has no folder branch. Extracted handlers reproduced **click: zero openings; unmoved pointerup: one opening**. Recipes has no dock alternative.

   This mechanism predates the branch, but directly blocks the new feature’s ordinary desk entrance. [Keyboard button activation](https://www.w3.org/WAI/ARIA/apg/patterns/button/) must work.

   **Fix:** handle native click activation and suppress the click following an actual drag. Add an Enter/Space smoke check.

2. **P3 | `room.js:1228`, `tools/test-core.js:2573` | Two-line folder bounds remain underestimated.**

   The original saved fixture now returns `tidied:true`:

   ```text
   y=4:  cycle x2, fertility x27, chapters x52, nutrition x77
   y=35: recipes x2, mind x27, move x52, body x77
   y=66: videos x2, doctor x27
   ```

   All pairs are clear using 22% width, 27% ordinary height and 32% doctor height.

   A different valid arrangement still produces intersecting button rectangles:

   ```text
   doctor:[2,4], fertility:[27,4], chapters:[52,4], nutrition:[77,4],
   cycle:[2,66], mind:[27,35], move:[52,35], body:[77,35], videos:[27,66]

   Result: recipes:[2,35], tidied:false
   Doctor bottom:36; Recipes top:35
   ```

   That 1% intersection may involve padding only, so I am not claiming visible text obstruction.

   **Fix:** use individual measured heights, or a conservative bound, and test this fixture. Current tests assume 27%.

   **Drag trace:** one successful drag now saves **every rendered folder’s coordinates** at `room.js:1284`. Reopening that fully saved desk cannot automatically tidy it. Explicit “Tidy the icons” intentionally resets it; a future new folder or failed storage changes those conditions.

3. **P3 | `room.js:555`, `:1393` | Some intro-abandonment paths retain the pending destination.**

   Begin from the old MEDAS link, replace the intro using a bottom tab, then reopen and finish the intro. The stale destination can still open. Closing the intermediate urgent sheet also bypasses the `current === 'onboarding'` check.

   **Fix:** clear pending navigation when abandoning the intro flow, while preserving it across intentional intermediate steps.

4. **P3 | `room.js:3036` | Returning-user boot navigation retains a narrow timer race.**

   Hash routing still opens unconditionally after 600 ms; loading disappears after 500 ms. Navigation during that interval can be replaced.

   **Fix:** cancel the boot dispatch once another navigation takes ownership.

5. **P3 | `room.js:2323`, `:2350` | Two open checklists can overwrite each other’s answers.**

   Each sheet retains an answer snapshot. In-memory reproduction: pane A saves `{veg:true}`; stale pane B answers Fish; stored answers become `{fish:false}`.

   **Fix:** merge the changed answer with current stored answers and refresh an open checklist after external changes.

6. **P3 | `tools/test-core.js:2548`, `:2585`; `tools/e2e_smoke.py:1966` | Tests permit meaningful regressions.**

   Executed in-memory mutations:

   | Mutation | Isolated result |
   |---|---|
   | 4 → 24 tablespoons | Caught |
   | Duplicate butter ID as oil | Caught |
   | Nonexistent recipe path | Caught |
   | Olive-oil criterion “or more” → “or less” | **24/24 pass** |
   | Save every dragged folder at `[0,0]` | **24/24 pass** |

   The browser drag assertion also accepts the last mutation because it checks only saved-key count.

   **Fix:** check threshold direction, exact saved coordinates and coordinates after reopening. Add keyboard activation and the abandonment scenarios above.

7. **P3 | `docs/design/2026-10-20-recipes.md:19`, `:88` | The overview still describes superseded behavior.**

   It retains the least-crowded fallback and the 2028 transition-end wording, conflicting with the applied-fixes section.

   **Fix:** update those statements or label them explicitly as historical.

All 13 retained MEDAS questions and hints substantively match Table 1, including serving sizes, thresholds, rabbit, commercial sweets and sofrito. The adaptation disclaimer and wine exclusion are clear. The pregnancy line is conservative relative to NHS exceptions; its fish restrictions and limits agree with the source. E107–E118 revealed no further substantive health-copy problem.

VERDICT: NOT READY