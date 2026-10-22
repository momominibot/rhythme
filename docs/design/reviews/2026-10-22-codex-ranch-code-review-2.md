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


## Round 4 (after settle, the hint, the subscriber and the grocer staple): see below once it ends
