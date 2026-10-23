HOLD

## A. Round-3 items

`SQL` means `supabase/migrations/20261022120000_plaza_rooms_chat.sql`. FIXED items need no further change for the original finding.

| Item | Verdict | Severity | Evidence, result and smallest fix |
|---|---|---|---|
| A7 | **NOT FIXED** | **P1** | `ovu-rooms.js:131`, `SQL:325`, `SQL:329`: “Take a break from citalopram” and “Don’t take citalopram” pass both checks and publish immediately through `SQL:524` in live mode. **Fix:** match benign exceptions against complete clauses, handle negative treatment instructions structurally, and keep live mode unavailable until that boundary is accepted. Another medicine name will not fix this. |
| A10 | **NOT FIXED** | P2 | `ovu-rooms.js:76`, `SQL:299`: an ordinary bare address such as `nhsinform.scot` still passes because general endings must have two letters or a following path. **Fix:** recognize hostnames independently of the partial suffix list, consistently on both sides. |
| B3 | **FIXED** | P2 | `ovu-rooms.js:615`: Report with Also block filters the author and calls `refetch()`, invalidating older feed replies. |
| 1. Stale staff decisions | **FIXED** | P2 | `SQL:623`, `SQL:626`, `admin.js:357`: the displayed revision and held status are checked after locking, so stale Show cannot reverse Hide. |
| 2. Send reply after Room chat Off | **FIXED** | P2 | `ovu-rooms.js:518`, `ovu-rooms.js:584`: successful Room chat Off invalidates older Send results through `chatGen`. This fixes the dedicated Off path; Plaza friends Off has a separate integration defect below. |
| 3. Report quoting a removed message | **FIXED** | P2 | `ovu-rooms.js:304`, `ovu-rooms.js:596`: removal from the visible window closes the report sheet and invalidates its actions. |
| 4. Late actions replace another sheet | **NOT FIXED** | P2 | `ovu-rooms.js:574`: delayed consent for advice text still invokes `send()`, opening `roomHold` over a newer sheet; `ovu-friends.js:463` also unconditionally reopens Friends after delayed Room chat Off. **Fix:** bind continuations and redraws, as well as closure, to the initiating sheet generation. |
| 5. Joins arriving out of order | **FIXED** | P2 | `ovu-rooms.js:445`, `ovu-rooms.js:461`: joins are serialized and the latest requested choice runs last. A separate displayed-membership problem remains below. |
| 6. Hide/show exceeding capacity | **FIXED** | P2 | `SQL:278`: every membership with a live group visit retains its place, including hidden and paused cards. |
| 7. Report-decision feedback disappears | **FIXED** | P2 | `admin.js:271`, `admin.js:347`: persistent `reportsNote` survives redraws. |
| 8. Reports overwrite the chosen filter | **FIXED** | P2 | `admin.js:280`, `admin.js:282`: responses must match both request generation and captured filter. |
| 9. Consent after leaving/rejoining | **FIXED** | P3 | `ovu-rooms.js:494`, `ovu-rooms.js:497`: delayed consent compares the original entry identity before continuing. |

**Coverage of unresolved items:** dry run, races, smoke and core miss A7 and A10’s examples. They also miss item 4: its smoke test uses benign On text, which never opens the subsequent hold/care sheet, and does not exercise delayed Off reopening Friends.

## B. New findings

1. **P2: an older On response reverses the phone’s newer Off state.**  
   `ovu-rooms.js:571`: when On commits, its response waits, and Off subsequently succeeds, the delayed On response records a local grant, sets `rooms.talk = true` and announces On although the server remains off.  
   **Smallest fix:** reject obsolete consent responses using mutation generation or ordered consent-event identity before applying any effects.  
   **Tests:** dry run, races, smoke and core miss this response ordering; the smoke delay occurs before On commits. Reproduced in memory.

2. **P2: Plaza friends Off does not invalidate pending room results.**  
   `ovu-friends.js:490`, `ovu-rooms.js:518`: successful Plaza friends Off deletes the server’s messages and membership, but an older Send response can temporarily restore deleted text and announce Sent before a denied poll clears it.  
   **Smallest fix:** share synchronous Rooms invalidation across successful social/age withdrawals, clearing membership and cached content and invalidating pending mutations.  
   **Tests:** all four suites miss this integration; the delayed-Send smoke calls only `OvuRooms.chatOff()`. Source-derived.

3. **P2: the help-domain exception removes contact details before validating them.**  
   `ovu-rooms.js:84`, `SQL:297`: “Email support@findahelpline.com” passes because removing the hostname first destroys the email pattern; the substring replacement also accepts different hostnames such as `findahelpline.company`.  
   **Smallest fix:** validate contacts first, then exempt only the exact permitted help hostname with complete boundaries.  
   **Tests:** all four suites miss these inputs. Actual module checks returned `problem:null, hold:null`.

4. **P2: ordinary contact-sharing grammar still publishes.**  
   `ovu-rooms.js:87`, `SQL:300`: “Call me on 555 1234” passes because telephone detection requires eight digits, while contact-intent detection covers only a few fixed constructions.  
   **Smallest fix:** recognize contact-sharing intent paired with local-number or email grammar, holding uncertain cases for review while preserving dates.  
   **Tests:** all four suites miss this case. Actual module checks returned `problem:null, hold:null`.

5. **P2: a refresh can restore an already-decided message in the staff queue.**  
   `admin.js:307`, `admin.js:359`: if a pre-decision queue read remains in flight when Show/Hide succeeds, the required fresh read is skipped and the older response reinstates the held row until another refresh.  
   **Smallest fix:** invalidate pre-decision reads and guarantee a fresh read after the active request settles.  
   **Tests:** all four suites miss the overlapping refresh/decision sequence. Reproduced using the actual loading functions.

6. **P2: successful Join can leave the previously viewed room looking joined.**  
   `ovu-rooms.js:463`, `ovu-rooms.js:221`: joining B while viewing previously joined A updates list membership but leaves A’s feed carrying its old entry, so A retains its composer and Send fails until polling reconciles it.  
   **Smallest fix:** synchronize current-feed membership on every successful Join and invalidate older membership snapshots before refetching.  
   **Tests:** all four suites miss this ordering; quick-join smoke remains in the last-chosen room. Reproduced in memory.

7. **P2: the staff queue can display review mode after live mode is enabled.**  
   `admin.js:321`, `admin.js:295`: refresh compares only messages and reports, so a mode-only response updates the cache without redrawing the displayed mode.  
   **Smallest fix:** include mode and other displayed availability state in the refresh comparison.  
   **Tests:** all four suites miss mode-only changes. Reproduced: cached mode became live with zero redraws.

8. **P3: cached room content has no local expiry during a prolonged outage.**  
   `ovu-rooms.js:251`, `ovu-rooms.js:424`: failed refreshes retain cached messages without checking their age, allowing an open tab and its copied report text to outlive the stated 24-hour window.  
   **Smallest fix:** prune expired rows and invalidate their report sheets locally, including when refresh fails and on visibility restoration.  
   **Tests:** all four suites omit expired cached content combined with failed refreshes. Source-derived.

Verification: **1,907 core checks passed, zero failed**; changed JavaScript syntax checks passed. Dry run, database races and browser smoke were inspected, not rerun. No files were edited and no migration was applied.