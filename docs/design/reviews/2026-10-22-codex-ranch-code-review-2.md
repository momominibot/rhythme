# Codex confirmation reviews of the ranch, 22 October 2026 (rounds 2 to 4)

Model gpt-6.1-sol, read-only, one guarded run each (RUN_STARTED, lock, BLOCK.json). Round 1 is in 2026-10-22-codex-ranch-code-review-1.md.

## Round 2 (after the nine fixes): HOLD

**HOLD.** Finding 1 remains P1: an unlocked care save can overwrite a completed purchase. In-memory reproduction: **120 hearts deducted, purchased hen disappears**. All farm writers must share the transaction.

| # | Result | Evidence |
|---|---|---|
| 1 | **NOT FIXED** | `ovu-barn.js:96–97`: care bypasses the lock at `:378`. |
| 2 | **FIXED** | Sizes follow consumption/purchases: `ovu-kitchen.js:92,105`, `ovu-barn.js:67,561`, `ovu-villagers.js:88`. |
| 3 | **FIXED** | Birth/due date drives cooldown: `ovu-ranch.js:65,122`. |
| 4 | **FIXED** | Backdated commands refused: `ovu-ranch.js:82,98,118`. |
| 5 | **FIXED** | Migration initializes full-love baseline: `ovu-ranch.js:47`. |
| 6 | **FIXED** | Breeding eligibility clamped to adulthood: `ovu-ranch.js:112`. |
| 7 | **FIXED** | Naming rejects the reported replacement-animal case: `ovu-barn.js:388,393`. |
| 8 | **FIXED** | Full dish storage refuses before consumption: `ovu-kitchen.js:88`. |
| 9 | **FIXED** | Attained adulthood persists: `ovu-ranch.js:52`. |

No new P1 found. **1,777 core checks passed**, plus targeted in-memory probes. Browser smoke not rerun. No files changed.


## Round 3 (after every barn, kitchen and villager writer went inside the farm lock): HOLD

**1. NOT FIXED overall.** Locked care preserves Bao, but other barn writes still bypass the transaction.

**P1 reproduced in memory with two stores, shared storage and one lock manager:**

- A’s `settle()` prepares its farm (`ovu-barn.js:413`).
- B acquires `ovumind-farm`, buys Bao and commits: **three hens, 880 hearts**.
- A resumes its unlocked save (`ovu-barn.js:415`): **two hens, 880 hearts**. Bao disappears; the 120-heart charge remains.

`settle()` runs when opening the ranch and from boot/new-day callbacks (`ovu-barn.js:425,569–570`). It is ranch-specific, so this is a remaining branch defect. Other omitted barn writes include `maybeHint()` (`:550–553`) and subscriber reconciliation (`:574`).

Kitchen `buyStaple()` also remains unlocked (`ovu-kitchen.js:101–106`, called directly at `ovu-lane.js:194`); an injected pre-commit interleaving likewise removed Bao.

The unchanged farm planting/watering/harvest writers and greenhouse basket writers retain the same concurrent read-modify-write hazard (`ovu-farm.js:105–112,150–154,164–169`; `ovu-greenhouse.js:150–153`). Their locking gap is a **pre-existing follow-up**, not worsened by these commits.

**2. No additional regression found in the listed categories.** Without Web Locks, I verified one invocation and a resolved return value (`ovu-farm.js:240–243`); this fallback provides no cross-tab exclusion. I found no duplicate callback introduced. Cooking and gifting recheck current inventory (`ovu-kitchen.js:85–88`; `ovu-villagers.js:115–124`). Timers remain outside locks (`ovu-barn.js:484–491`; `ovu-kitchen.js:150–162`).

**3. HOLD: P1 remains, incomplete farm-writer locking; no additional P2 identified.**

`node tools/test-core.js`: **1,780 passed, 0 failed**. Its writer check enumerates selected action functions and misses these lifecycle/direct saves (`tools/test-core.js:5138`). No files modified.


## Round 4 (after settle, the hint, the subscriber and the grocer staple): HOLD

1. **NOT FIXED (P1).** Boot-settle versus a locked hen purchase passed in both orders, including counter opening. However, grocer seed/unlock purchases still bypass the lock (`ovu-lane.js:186`; `ovu-farm.js:175,180`), as does swapping (`ovu-lane.js:213`).

   Reproduced with real modules, two stores, shared storage and one lock: A’s locked settle prepares its farm (`ovu-barn.js:414`); B successfully buys three seeds for 10 hearts; A saves (`:416`). Final result: **zero seeds, 990 hearts from 1,000**. This remaining grocer path falls within “any grocer writer.”

2. **Regressions and checks:**

   - **P2, delayed ranch reopening:** `ovu-barn.js:424` checks only the scene after awaiting settle. An external redraw (`:571,582`) queued behind another tab’s lock reopens a counter dismissed before completion. Reproduced.
   - **P2, stale size display:** “every reader trims” is false. Today (`ovu-today.js:71,73`) and barn pantry (`ovu-barn.js:288`) read unreconciled sizes. A restored mismatch displayed **“Egg (3 large)” with count 1**. Account saves copy the farm unchanged (`ovu-gamesave.js:154,201`); the subscriber no longer repairs it (`ovu-barn.js:579`). Kitchen (`ovu-kitchen.js:58,92,105`) and villagers (`ovu-villagers.js:78,88`) use totals and maintain sizes when consuming. Barn sprites (`ovu-barn.js:200,265`) use herd data, not product sizes.
   - **P2, duplicate viewer routing:** load (`ovu-pageview.js:33`) and polling (`:58`) both dispatch during the 320 ms closing window (`:74`). Both event orders reproduced two `medas` dispatches. `room.js:3596` provides another handoff.
   - **Cross-origin guard gap:** restricted `loc.pathname` access occurs outside the catch (`ovu-pageview.js:57,58`), causing repeated exceptions. Normal closing eventually clears polling (`:56`), so no permanent normal-close leak was found.
   - No synchronous-sheet-opening dependency or boolean misuse of `settle()` found: hotspot handlers return `true` themselves (`ovu-barn.js:534`), callers chain/ignore settlement, and smoke tests await selectors. The grocer’s inside-lock `stillOpen` recheck (`ovu-lane.js:195`) correctly cancels dismissed purchases.

`node tools/test-core.js`: **1,780 passed, zero failed**. No files modified.

**HOLD: P1 unlocked grocer writers; P2 delayed ranch reopening, stale size display, duplicate viewer routing and cross-origin polling errors.**



## Round 5 (after every grocer, farm-scene and greenhouse writer, the counter token, viewSizes and one viewer hand-over): HOLD

(The guarded runner misread Codex's own probe line "Error: The coop is full" as a provider error and wrote a BLOCK.json; the review itself completed. The runner now matches Codex's uppercase `ERROR:` only.)

`node tools/test-core.js`: **1,785 passed, 0 failed**. Additional in-memory interleaving probes found blockers. No files changed.

1. **P1: writes can still be lost.** Farm-save inventory:

   - `ovu-barn.js:30,33,472,564`: locked through their action callers, settle and hint wrappers.
   - `ovu-kitchen.js:97,106`: locked through cooking completion (`:162`) and grocer (`ovu-lane.js:205`).
   - `ovu-villagers.js:120`: locked at `:124`.
   - `ovu-lane.js:194,205,216,230`: seed/unlock, staple, herb-start and swap callers now locked.
   - `ovu-farm.js:102,141,142,147,173,202,225,226`: active callers locked at `:348,420,431,486,489` or the grocer. `:126` writes only a shadow store; legacy `water()` (`:132`) has no production caller.
   - **Exception:** `ovu-farm.js:376` calls unlocked `write()` (`:93`). Reproduced: guide captures farm → second store buys Bao under the shared lock → guide saves. **Bao disappears; hearts remain 880 instead of 1,000.**
   - `ovu-greenhouse.js:192,224,241`, through save/thank sinks (`:153`; `ovu-rewards.js:149`): locked through grocer, planter and brew callers.
   - `ovu-rewards.js:140,149`: generic sinks rely on caller locking. `spendWith` lives in `ovu-stamina.js:51`, committing at `:54`.
   - **Exception:** `ovu-gamesave.js:201` applies farm patches under **`ovumind-gamesave`**, not the farm lock (`:242`). Reproduced: link upload captures farm → locked purchase → delayed acknowledgement (`:220`) restores two hens and 1,000 hearts, losing the purchase.

2. **P2 results:**

   - **Delayed reopening: NOT FIXED fully.** Existing-counter dismissal passes. Initial request → another sheet opens/closes → settle resolves still opens the counter (`ovu-barn.js:426–431`).
   - **Size display: FIXED.** Three stored large eggs with pantry total one displays one; stored mix stays untouched (`ovu-ranch.js:145`; `ovu-today.js:71`; `ovu-barn.js:288`).
   - **Duplicate routing: FIXED.** Load/poll/nested-boot in each tested order dispatched once (`ovu-pageview.js:55`).
   - **Cross-origin polling: FIXED.** Throwing pathname or hash getters caused no uncaught error (`ovu-pageview.js:65`).

3. **Async regression, P2:** Care clears its token before queuing the lock (`ovu-care.js:39–44`). Stop, close, replacement-sheet and sleep during that wait still planted, charged two energy, rendered/toasted and reopened the sheet. Farm lacks a re-check (`ovu-farm.js:431–451`); greenhouse likewise (`ovu-greenhouse.js:499–508`); harvest permits a closed sheet (`ovu-farm.js:420`). Shed cancellation passes (`:486,490`). No double charge or charge without effect reproduced; insufficient energy/storage failure preserved resources.

**HOLD: P1 unlocked guide and GameSave overwrite; P2 residual ranch reopening and async cancellation/sheet ownership.**

## Round 6 (after the guide flag and the game-save cycle inside the farm lock, the sheet counter guard and step re-checks): see below once it ends
