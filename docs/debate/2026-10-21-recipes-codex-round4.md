<!-- Codex read-only review, round four, 21 October 2026 (gpt-6-astra, web search on), of 1d08c18 and the whole feature. One guarded run. -->

One P2 and five P3 findings remain. No P1 found; no files changed.

| Round-three finding | Result | Evidence |
|---|---|---|
| Keyboard folder opening | **FIXED** | `room.js:1265–1268` handles native clicks, including Enter/Space; drag completion suppresses its trailing click. |
| Two-line folder collisions | **FIXED** | `room.css:686–688` scales icons and labels; `room.js:1227` reserves 31% height. The reported fixture is covered at `tools/test-core.js:2587`. |
| Abandoned intro retains destination | **FIXED** | `room.js:2776` ties navigation to the exact onboarding instance started by Begin. A restarted intro cannot consume it. |
| Returning-user boot race | **NOT FIXED completely** | Opening another sheet cancels navigation, but tapping Home does not. Finding 3. |
| Two tabs overwrite answers | **NOT FIXED completely** | Sequential updates work after storage events; delayed events still permit overwrites. Finding 2. |
| Threshold-direction and coordinate test gaps | **FIXED** | `tools/test-core.js:2548` checks direction; `tools/e2e_smoke.py:1990–1994` checks exact saved and reopened coordinates. A separate gap remains below. |
| Stale design overview | **FIXED** | `docs/design/2026-10-20-recipes.md:19` describes grid reset; `:88` no longer invents a transition end date. |

1. **P2 | ovu-recipes.js:30 | Pregnancy guidance misses uncooked mirin**

   The red-rice salad contains **50 ml mirin in an uncooked dressing**, shaken and added immediately before serving. Neither its card nor the shared pregnancy notice at line 73 mentions an alcohol-free substitution. The recipe appears both in Recipes and among MEDAS suggestions. [Original recipe](https://www.jeanhailes.org.au/recipes/red-rice-roast-vegetable-and-aduki-bean-salad/)

   Regular mirin contains alcohol, while NHS guidance recommends avoiding alcohol during pregnancy and when planning pregnancy. This is incomplete guidance, not evidence that one serving causes harm; the amount depends on the product and serving. [Japanese food composition database](https://fooddb.mext.go.jp/details/details.pl?ITEM_NO=16_16025_7), [NHS guidance](https://www.nhs.uk/pregnancy/keeping-well/drinking-alcohol-while-pregnant/)

   **Fix:** add a qualification to this card, wherever rendered: use a verified alcohol-free mirin alternative or alcohol-free dressing when pregnant or trying to conceive.

2. **P3 | room.js:2327 | Delayed storage events still allow answer loss between tabs**

   `stored()` reads cached `S.state()`. It does not read the latest persisted state before merging.

   Reproduced with the actual store in two VM windows sharing storage: both start empty; A saves `{veg:true}`; B saves Fish before receiving A’s storage event. Persisted answers become `{fish:false}`. The same ordering can resurrect answers after Clear. Ordinary sequential use works, so this remains a timing-edge P3.

   **Fix:** serialize checklist mutations, including Clear, with a shared lock; reload, merge and commit inside that lock. Add delayed-event coverage. The current browser test waits between writes.

3. **P3 | room.js:3044 | Tapping Home does not cancel delayed boot navigation**

   The guard checks only `sheetSeq` and `current`. `goTab('home')` at line 1393 changes neither when Home is already visible.

   A returning visitor opening `#medas` can tap Home during the 500–600 ms startup interval and still have the checklist open afterward. Executing the actual functions with a captured timer produced `tab:home → open:medas`.

   **Fix:** track explicit navigation separately from sheet openings, including Home, and check that generation before dispatching the boot route.

4. **P3 | ovu-recipes.js:22 | Fertility evidence wording is too categorical**

   “Studies of people trying to conceive are observational and mixed” accurately describes the cited 2024 review, but overgeneralises the current evidence. A March 2026 study used a **nonrandomized controlled dietary intervention**, involving 32 women over 12 weeks. Its clinical findings remain exploratory and do not establish fertility benefit. [Original study abstract](https://pubmed.ncbi.nlm.nih.gov/41901619/)

   **Fix:** say “The studies in the 2024 review were observational and mixed,” or “Evidence is limited and mostly observational.” Preserve the existing caution against treatment claims. E79 itself remains accurate.

5. **P3 | room.js:1261 | Folder opening and closing lack focus handoff**

   The new Recipes folder inherits finder behavior that inserts content and scrolls it into view without moving focus or announcing expansion. Keyboard focus remains among the desktop icons. Closing the finder at line 1335 hides its focused close button without restoring focus.

   Access remains possible, but the newly working keyboard entrance is cumbersome and unclear with assistive technology.

   **Fix:** expose expanded state, move focus into the opened folder, and restore focus to its originating icon on close.

6. **P3 | tools/e2e_smoke.py:1883 | Tests miss answer deselection regressions**

   The implementation allows a second tap on the selected answer to return that item to unanswered. Neither the browser scenarios nor the core checks exercise this behavior.

   An in-memory mutation replacing the toggle at `room.js:2361` with unconditional assignment still passes all **29 isolated recipe/MEDAS checks**. Existing browser scenarios select answers once and then use Clear.

   **Fix:** test repeated Yes, repeated Not usually, and switching answers. Verify button state, counts, storage and reload results.

The remaining MEDAS wording matches [PLOS Table 1](https://journals.plos.org/plosone/article/file?id=10.1371/journal.pone.0043134&type=printable). The menopause wording and PMOS rename are supported by the [2023 position statement](https://menopause.org/wp-content/uploads/professional/2023-nonhormone-therapy-position-statement.pdf) and [2026 Lancet consensus](https://pubmed.ncbi.nlm.nih.gov/42119588/). No further substantive E73–E84 issue, recipe-title mismatch, invented price, copied recipe instructions, added user-facing em dash, or new exploitable HTML injection was found. Two Jean Hailes pages required indexed first-party text because direct opens returned errors.

Validation: **1,033 core checks passed**. Direct `tools/check.py` was blocked by its temporary-file creation; an equivalent execution using stdin instead completed **81 pages, zero problems**. Browser tests were inspected, not run.

VERDICT: NOT READY