**HOLD.** Read only; nothing changed. Core suite: **1,769 passed**. Additional in-memory probes reproduced these defects:

1. **P1: Concurrent purchases lose paid animals.** `ovu-barn.js:431–438` builds the farm before spending; no shared transaction protects it. A prepares a cow purchase, B buys a hen, A finishes: **360 hearts deducted, only the cow survives**. Serialize every farm mutation and reread inside that transaction.

2. **P2: Product sizes survive consumption.** `ovu-kitchen.js:91,104`, `ovu-barn.js:67`, `ovu-villagers.js:88`. Cook the only large egg, then buy a grocer egg before reconciliation: the purchased egg inherits `large`. Update totals and sizes together at every consumer and producer.

3. **P2: One cow can deliver twice on the same day.** `ovu-ranch.js:116` records the planning date for cooldown. Plan October 22, first birth October 29, plan again October 29: the second calf arrives immediately. Base cooldown on birth/due date.

4. **P2: Backward clocks bypass baby timers.** `ovu-ranch.js:93–100` accepts incubation dated October 1 despite `lastDay=October 22`. Returning to October 22 immediately produces a grown hen. Reject backward dates in commands, beyond `advance()`.

5. **P2: Migration omits full-love eligibility.** `ovu-ranch.js:44–49,106–107`. Legacy Clover at love 10 lacks `full`; even a week after migration, breeding remains unavailable until another care action. Initialize its migration baseline.

6. **P2: Juvenile love starts the adult breeding timer.** `ovu-ranch.js:105–109`. A calf reaching love 10 before adulthood can deliver immediately upon adulthood. Retain `love.full`, but clamp breeding eligibility to `adultOn`.

7. **P2: Account restore can rename a different animal.** `ovu-barn.js:386,541–548`. Leave a calf’s naming dialog open; the account copy replaces its `cow1` with a bought adult `cow1`. Saving renames that adult. Cancel or validate the dialog against the restored animal’s identity.

8. **P2: Full dish storage destroys ingredients.** Existing integration defect, `ovu-kitchen.js:85–95`: cooking with 99 tomato-and-egg dishes consumes the egg and crops, returns success, and retains 99 dishes. Refuse before consumption.

9. **P3: Adulthood reverses after clock rollback.** `ovu-ranch.js:51` ignores persisted `grown`. A grown chick becomes a baby again when the date precedes `adultOn`. Preserve attained adulthood.

Missing regressions include these scenarios, real paid purchases with storage failure, competing last-slot commands, and restore during care. `tools/test-core.js:5062` supplies the missing legacy `full` field; `:5074` tests rollback only through `advance`; `:5079` never tests an actual baby. The new smoke flow uses free tester purchases.

Sequential reservation/hatching checks passed. Normal activity guards, name sanitization, tester spending, and complete nested-farm packing showed no additional defect. Browser smoke was not rerun.

