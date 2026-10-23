MERGE

## A. Round-5 items

No P0 or P1 remains. `SQL` means `supabase/migrations/20261022120000_plaza_rooms_chat.sql`. Severities retain the original finding’s classification.

| Item | Verdict | Severity | Evidence and result | Smallest fix |
|---|---|---|---|---|
| A10 | **NOT FIXED** | P2 | `ovu-rooms.js:98`, `SQL:315`: the reported examples now refuse, but `See x.com` newly passes because one-character host labels are excluded. | Recognize valid short host labels, retaining explicit prose exceptions. |
| B3 | **FIXED** | P2 | `ovu-rooms.js:87`, `SQL:348`: `https://findahelpline.com.evil.scot` no longer receives the help-host exemption. | None. |
| B4 | **FIXED** | P2 | `ovu-rooms.js:112`, `SQL:339`: `Call 5551234` now returns `contact`. | None for the reported case; see B below. |
| New 1 | **FIXED** | P2 | `ovu-rooms.js:278`: pruning invalidates the pending feed generation, preventing an unchanged-window response from breaking the rooms. | None. |
| New 2 | **FIXED** | P2 | `ovu-rooms.js:342`, `:587`: observing a newer remote Off invalidates the delayed Send response. | None. |
| New 3 | **FIXED** | P2 | `ovu-rooms.js:285`, `:644`: an equal, same-state consent event succeeds instead of cancelling the waiting message. | None. |
| New 4 | **NOT FIXED** | P2 | `ovu-rooms.js:91`, `SQL:301`: `My appointments are 2026-10-22-2026-10-23` still returns `contact` because the intervening hyphen prevents recognition of the second date. | Recognize complete compact date ranges before counting telephone digits. |
| New 5 | **FIXED** | P3 | `SQL:679`: expiry is checked after locking and before applying the staff decision. | None. |
| New 6 | **NOT FIXED** | P3 | `admin.js:429`: after B loads her proposals, A’s delayed network rejection still replaces them with `[]`; only tagged cancellation errors are ignored. | Capture `acctGen` in the loader and ignore obsolete-generation failures. |

Existing tests miss all three remaining failures. Added browser checks cover the three corrected concurrency orderings; the dry run covers expired decisions.

## B. New findings

1. **P2: date stripping lets an explicit international contact number through.**  
   `ovu-rooms.js:110`, `SQL:333`: `Call +45 20-12-2012` now passes because the subscriber number is removed as a date, leaving only the country code.  
   **Smallest fix:** preserve complete international telephone expressions before exempting independent dates.  
   **Tests:** missed; the actual module rejected this before the change and accepts it now.

2. **P2: ordinary conversation containing “call” and an unrelated number is refused.**  
   `ovu-rooms.js:112`, `SQL:339`: `After the phone call I managed 10000 steps` now returns `contact` because any five-digit run later in the message satisfies the bare-word rule.  
   **Smallest fix:** bind bare contact commands to a nearby telephone expression within the same clause.  
   **Tests:** missed; the actual module accepted this before the change.

No additional defect found in the admin merge resolution: phase 0 feed/overview generations, hold handling and account-reset invalidation remain intact (`admin.js:404`, `:462`). The CSS and service-worker merge retains both features.

Verification: **2,008 core checks passed, zero failed**; JavaScript syntax checks passed. Failures above were reproduced in memory. Database and browser suites were inspected, not rerun. No files edited or migration applied.