HOLD

1. **P0, `admin.js:292`:** Held-message replies and cached bodies survive an account switch, so a nonstaff account can see the previous staff account’s queue. Reproduced with a delayed reply. **Smallest fix:** Bind requests to the initiating account and generation; on auth/storage changes, immediately clear sensitive state and recheck staff access.

2. **P1, `ovu-rooms.js:414`:** Confirming a care/hold sheet opened in Chat can send its captured text into Vent after another device changes room membership, because `feed.entry || rooms.entry` does not require the entry to belong to the viewed room. Reproduced. **Smallest fix:** Capture account, visit, room and entry when opening the sheet, validate them on confirmation, and reject mismatches.

3. **P1, `supabase/migrations/20261022120000_plaza_rooms_chat.sql:435`:** Approved older messages never reach readers whose cursor has advanced, while writers retain stale held status and miss the automatic care reminder. **Smallest fix:** Return the complete visible 40-message window, or deliver revisions independently of creation IDs; test approval after a newer message has arrived.

4. **P1, `ovu-rooms.js:240`:** A read denial retains cached messages, writable membership and the composer; a subsequent rooms response with `read:false` also leaves the open feed intact. Reproduced with `why:'hidden'`. **Smallest fix:** Clear the feed and writable entry on authorization loss, invalidate pending replies, and display the refusal.

5. **P1, `supabase/migrations/20261022120000_plaza_rooms_chat.sql:552`:** Staff analysts can request `admin_plaza_messages('shown')` or `'hidden'` and read unreported messages across groups, exceeding the disclosed held-message/report access. **Smallest fix:** Restrict the endpoint to held messages and authorized report content; reject other statuses.

6. **P1, `ovu-friends.js:330`:** “Staff never see … your group” contradicts the new queue and reports, which include group, room, card and message together; `ovu-plaza.js:224` similarly promises counts only. **Smallest fix:** Update both notices to disclose the group and room context attached to moderation.

7. **P1, `supabase/migrations/20261022120000_plaza_rooms_chat.sql:290`:** Ordinary treatment instructions such as “Take 4 ibuprofen every 2 hours” and “Start taking aspirin every day” produce no hold and therefore publish immediately in live mode. **Smallest fix:** Add conservative instruction and tablet-dose detection with independent fixtures, and retain review mode until that boundary is validated.

8. **P1, `ovu-rooms.js:169`:** Rooms omit the existing legacy-minor guard, so a phone marked `under13` or another under-18 band can access rooms when its account already has an `age_18` grant, contrary to section 9’s client boundary. **Smallest fix:** Apply `OvuConsent.legacyMinor()` before requesting, rendering or acting, and clear rooms when that state changes.

9. **P2, `ovu-rooms.js:421`:** A successful send clears text typed while the request was pending, deleting the next draft. Reproduced. **Smallest fix:** Clear only the submitted, unchanged draft and apply reply effects only to the original visit and entry.

10. **P2, `supabase/migrations/20261022120000_plaza_rooms_chat.sql:270`:** The fixed suffix list permits ordinary bare links such as `example.co` and `myprofile.me`, despite the no-links rule. **Smallest fix:** Broaden domain detection consistently on server and client and add these bypasses to the fixtures.

11. **P2, `tools/db/plaza_rooms_dryrun.sql:174`:** The lock assertions can pass when the tested function acquires no locks, because earlier calls already acquired them in the same transaction; line 143 also proves possession rather than acquisition order. **Smallest fix:** Test each acquisition in a fresh transaction and add contention tests sensitive to reversed order and checks performed before locking.

12. **P3, `ovu-rooms.js:225`:** Nested malformed replies such as `{ok:true,rooms:[null]}` throw instead of hiding rooms and leave `busy.rooms` stuck. Reproduced. **Smallest fix:** Validate row contracts before use, route processing errors through `malformed()`, and guarantee busy-state cleanup.

13. **P3, `supabase/migrations/20261022120000_plaza_rooms_chat.sql:33`:** Adding `plaza_chat` to the purpose constraint also permits generic `consent_record` grants, bypassing the dedicated card/event freshness checks. **Smallest fix:** Reject generic grants for this purpose and require `plaza_chat_on`; retain generic withdrawal support.

14. **P3, `supabase/migrations/20261022120000_plaza_rooms_chat.sql:423`:** Feed authorization runs outside the account and membership locks, so a concurrent withdrawal or group move can commit between eligibility checks and body retrieval. This narrow race was identified from source, not executed. **Smallest fix:** Hold account then membership locks through authorization and feed construction, and add a revocation race.

The core suite passed **1,824 checks**. Its smoke fixtures omit the delayed replies, approval transitions and authorization-loss scenarios above. Database races and the migration dry run were inspected, not rerun; no files were edited.

