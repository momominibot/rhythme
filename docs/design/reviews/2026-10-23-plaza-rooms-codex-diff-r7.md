MERGE

## A. Round-6 items

`SQL` = `supabase/migrations/20261022120000_plaza_rooms_chat.sql`. Severities retain the original classification.

| Item | Verdict | Evidence and result | Smallest fix |
|---|---|---|---|
| A10 | **P2 FIXED** | `ovu-rooms.js:100`, `SQL:315`: `See x.com` is refused while `I.love it` remains allowed. | None. |
| New 4 | **P2 FIXED** | `ovu-rooms.js:93`, `SQL:301`: compact appointment date ranges no longer return `contact`. | None. |
| New 6 | **P3 FIXED** | `admin.js:429`: obsolete-generation successes and untagged failures preserve the new account’s proposals. | None. |
| New 1 | **P2 FIXED** | `ovu-rooms.js:113`, `SQL:334`: `Call +45 20-12-2012` is refused before date removal. | None for the reported case; see B. |
| New 2 | **P2 FIXED** | `ovu-rooms.js:91`, `SQL:344`: `After the phone call I managed 10000 steps` remains allowed. | None. |

## B. Introduced defects

1. **P2: gestational age followed by a date is wrongly refused.**  
   `ovu-rooms.js:113`, `SQL:334`: `I was 12+3 (2026-10-22) at my scan` now returns `contact` because the international-phone rule consumes `+3 (2026-10-22)` before date removal; the parent accepts it.  
   **Smallest fix:** prepend `(?<![0-9])` to the international-phone regex in both implementations and add this regression fixture. An in-memory check restores acceptance while preserving refusal of the reported international number.

No P0 or P1 found. **2,008 core checks passed**, and JavaScript syntax checks passed. SQL inspected; database and browser suites not rerun. No files edited.