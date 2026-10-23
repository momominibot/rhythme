HOLD

## A. The 14 round-1 findings

SQL references below mean `supabase/migrations/20261022120000_plaza_rooms_chat.sql`. Severities on FIXED items are their original severities.

1. **FIXED, P0, `admin.js:41`, `admin.js:425`.** Requests bind account and generation; account changes clear cached data and reboot access checks. The delayed-account-switch smoke covers this. No further fix needed.

2. **FIXED, P1, `ovu-rooms.js:451`, `ovu-rooms.js:458`.** Care/hold confirmations retain the original account, visit, room, entry and text, and reject changed context. No further fix for that path; the consent path has a separate defect in B1.

3. **NOT FIXED, P1, SQL:600; `ovu-rooms.js:279`.** An approval can allocate revision 10, remain uncommitted while another author commits revision 11, and then be permanently skipped by a writer already caching the held row. The missing-row reset does not detect stale existing rows, so the held status and care reminder remain wrong. **Smallest fix:** return the complete visible 40-message window, including current row state. **Tests:** sequential approval dry run and smoke pass; none tests commit-order inversion.

4. **NOT FIXED, P2, `ovu-rooms.js:205`, `ovu-rooms.js:273`, `ovu-rooms.js:542`.** Read denial clears the feed and composer but leaves an open Report sheet displaying its copied message body. **Smallest fix:** close and invalidate room sheets when reading is denied. **Tests:** the denial smoke has no sheet open and misses this.

5. **FIXED, P1, SQL:614.** The public staff endpoint rejects statuses other than `held`, and its helper independently selects held messages only at SQL:586. The dry run checks rejected statuses. No further fix needed.

6. **NOT FIXED, P1, `ovu-plaza.js:208`, `ovu-plaza.js:225`.** Opening Plaza groups before the availability probe still says staff see only counts, even when room moderation exists, because this path never probes or updates that paragraph. **Smallest fix:** use an unconditional, accurate room-message exception. The Friends path now probes before drawing its corrected notice. **Tests:** none checks the first-open Plaza notice.

7. **NOT FIXED, P1, SQL:305; `ovu-rooms.js:119`.** The original examples now hold, but ordinary instructions such as “Take insulin before meals” and “Stop taking antibiotics” still return no hold and publish immediately in live mode. **Smallest fix:** conservatively hold ordinary treatment commands and expand independent fixtures; keep live mode disabled until that boundary is accepted. **Tests:** all current suites omit these counterexamples. Default review mode mitigates the initial rollout.

8. **NOT FIXED, P1, `ovu-rooms.js:544`, `ovu-rooms.js:558`.** The main under-18 boundary works, but an already-open message menu survives the age change and can still report or block because its callbacks never check `allowed()`. An in-memory reproduction marked the phone minor, cleared its feed, and still issued `plaza_report_message`. **Smallest fix:** close room sheets on age changes and guard every action callback. **Tests:** the minor smoke has no message menu open.

9. **FIXED, P2, `ovu-rooms.js:474`.** Send completion clears only the unchanged submitted text, preserving a newer draft. The delayed-send smoke covers this. No further fix needed.

10. **NOT FIXED, P2, SQL:284; `ovu-rooms.js:76`.** The new suffix branch still permits ordinary links including `t.me/alice`, `t.co/hello` and `example.health`. **Smallest fix:** recognize valid short labels and broader domain endings consistently on both sides. **Tests:** shared fixtures cover the original examples but omit these bypasses.

11. **FIXED, P2, `tools/db/plaza_rooms_dryrun.sql:152`, `tools/db/race_test.py:228`.** Fresh accounts establish account-lock acquisition, and contention checks verify that the account lock is held while waiting for membership. These address the original false-positive checks. No further fix needed.

12. **FIXED, P3, `ovu-rooms.js:256`, `ovu-rooms.js:260`.** Invalid nested room rows enter `malformed()` and release busy state. An in-memory `{ok:true,rooms:[null]}` reproduction produced `broken:true`, `busyRooms:false`, `rooms:null`. **Tests:** this exact regression still lacks a committed runtime fixture.

13. **FIXED, P3, SQL:368, SQL:525.** The insert trigger rejects generic Room chat grants; the dedicated function enables its transaction-local marker only around its checked insertion. The dry run checks generic rejection. No further fix needed.

14. **FIXED, P3, SQL:452.** Feed authorization now runs under the reader’s account lock and shared membership lock. The withdrawal-versus-feed race covers the reported revocation path. No further fix for that finding; B7 concerns a different moderation race.

## B. New findings, ranked by severity

1. **P1, `ovu-rooms.js:448`, `ovu-rooms.js:518`: delayed consent sends a different, unsubmitted draft.** After requesting Room chat in Chat, closing the pending sheet, entering Vent and typing another draft, the grant reply recursively calls `send()` and submits the Vent draft without another Send tap. **Smallest fix:** capture the original send context before consent and resume only that still-valid context. **Tests:** missed by dry run, races, smoke and core; reproduced against the real client in memory.

2. **P1, SQL:538: choosing Off while already off does not invalidate an older consent form.** Because no withdrawal event is appended, a previously opened form retains a matching `p_seen`, can re-enable chat, and resumes sending despite the intervening explicit Off. **Smallest fix:** always record the explicit withdrawal decision under the account lock. **Tests:** all suites miss this; existing Off scenarios begin with chat on.

3. **P2, `ovu-rooms.js:528`, `ovu-rooms.js:270`: an older feed reply restores deleted messages.** A feed requested before successful Room chat withdrawal can resolve afterward and repopulate the messages just removed locally; the Block path has the same stale-response problem. **Smallest fix:** invalidate pending feed generations after successful Off or Block, then fetch a fresh snapshot. **Tests:** all suites miss the interleaving; the Off case was reproduced in memory.

4. **P2, `admin.js:402`, `admin.js:419`: the open staff queue never fetches new queue content.** Its timers refresh overview/activity, then redraw cached messages, so new held messages remain unseen and withdrawn or expired bodies remain displayed until tab re-entry or a decision. **Smallest fix:** refresh held messages and reports while Queue is visible, with one account-bound request in flight. **Tests:** all suites miss this; staff smoke checks initial loading and post-decision refresh only.

5. **P2, `admin.js:347`, `admin.js:349`: failed moderation feedback disappears immediately.** Show/Hide failures write an error into `roomMsgsMsg`, but the unconditional redraw replaces that node with an empty message. **Smallest fix:** preserve decision feedback across redraws or restore it afterward. **Tests:** all suites miss this; smoke exercises successful Show only.

6. **P2, `ovu-rooms.js:413`: incoming messages interrupt reading.** Any increase in message count forces scrolling to the bottom even when the reader deliberately scrolled upward. **Smallest fix:** follow the bottom only on initial rendering or when already near it. **Tests:** none exercises incoming messages while scrolled up.

7. **P3, SQL:459, SQL:466: feed construction mixes visibility snapshots.** A staff hide or third report between ID selection and body retrieval can return a now-hidden or held row to a nonwriter because the later query does not recheck visibility. **Smallest fix:** construct IDs, rows and revisions from one visible-window query. **Tests:** no current database race covers this interleaving; source-derived, not database-reproduced.

8. **P3, SQL:399: “Last message” includes messages the reader cannot see.** Blocked, hidden or paused authors can determine that timestamp although their messages are excluded from the feed. **Smallest fix:** apply the viewer’s visibility predicate when calculating `last_at`. **Tests:** all suites miss this visibility mismatch.

9. **P3, `admin.js:271`: the staff notice still denies receiving groups.** It says staff never see groups although room reports include group and room context at SQL:568. **Smallest fix:** add the room-message exception to this notice. **Tests:** existing staff smoke checks a legacy note report and misses this contradiction.

Verification: **1,834 core checks passed**, and JavaScript syntax checks passed. Delayed consent, stale-feed restoration, minor-menu actions, and link/advice bypasses were reproduced with in-memory checks. Database dry runs, races and browser smoke were inspected, not rerun. No files were edited or migrations applied.