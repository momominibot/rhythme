VERDICT: REJECT

Reviewed `7a4a139..d77a076`. SQL references below are to `supabase/migrations/20261019130000_plaza_friends.sql`.

1. **RESOLVED, round-one #1.** SQL:349 rejects edits naming a deleted or replaced card; SQL:352 requires explicit opt-in when social consent is absent. `ovu-friends.js:341` sends adult attestation and opt-in only from the form’s actual checkboxes. The original stale-edit withdrawal scenario is closed. A separate age-withdrawal race remains in finding 13.

2. **NOT RESOLVED, blocker, round-one #2**, `ovu-friends.js:490`: **Account changes in another tab leave the previous account’s information visible.** Cleanup depends on `A.subscribe`, but the actual authentication module does not emit that callback for cross-tab storage changes. I reproduced A’s card and friends remaining visible after another tab switched to B. The next inbox refresh used B’s token and updated cached state, while the open sheet still displayed A’s information. **Smallest fix:** propagate cross-tab authentication changes through the common sheet/cache reset and bind forms and requests to an authentication generation.

3. **RESOLVED, round-one #3.** SQL:179 defines consistently ordered account locks. Ask, answer, unfriend, block and note acquire both accounts’ locks before authorization and mutation at SQL:420, 460, 483, 497 and 522. SQL:566 also filters inbox notes by friendship and absence of blocks.

4. **RESOLVED for social withdrawal and pauses, round-one #4.** The withdrawal trigger takes the same account lock before deleting social data at SQL:309. `social_off` and staff pause/remove also participate at SQL:384, 624 and 630. This closes the original writer-versus-social-withdrawal race by source inspection.

5. **NOT RESOLVED, major, round-one #5**, SQL:273: **Blocking still reveals a blocked person’s current card.** `social.visible` does not check existing blocks or both accounts’ eligibility. If B blocks A while both remain in the same group, A can call `social_block(B.handle)` and receive B’s current name/look through the blocked-list snapshot at SQL:288. Unblocking A’s own block permits repetition despite B’s block. **Smallest fix:** require eligibility and no existing two-way block before copying current card details; otherwise retain a previously authorized snapshot or use “Someone.”

6. **NOT RESOLVED, major, round-one #6**, SQL:277: **Hidden callers retain a group-membership probe through blocking.** `social_ask` now rejects hidden callers, but the co-presence branch of `social.visible` checks only the target’s hidden flag. Hidden A, holding a nonfriend B’s remembered handle, can join candidate groups and block B. A named snapshot versus “Someone” reveals whether B is present; A can unblock and repeat without becoming visible. **Smallest fix:** require mutual visibility for the co-presence snapshot, alongside the eligibility/block checks in finding 5.

7. **NOT RESOLVED, major, round-one #7**, `ovu-friends.js:236`, `ovu-friends.js:481`: **Automatic retries continue after failed social requests.** Visit-bound caching and immediate clearing are fixed. However, ordinary plaza callbacks with `offline:false` clear `failedVisit` and restart `social_people`; inbox failures are swallowed and retried every minute. I reproduced failed people-call counts increasing **2 → 3 → 4** after unchanged-visit callbacks. **Smallest fix:** retain a failure flag for both people and inbox requests until an explicit user retry. Heartbeats, renders and visibility events must not clear it.

8. **RESOLVED, round-one #8.** SQL:443 counts declined and pending requests against the same 14-day quota. Declining no longer immediately frees a detectable slot.

9. **RESOLVED by source inspection, round-one #9.** Both endpoint account locks precede friendship capacity checks and insertion at SQL:431 and 470. The sender’s lock also precedes request-capacity checking at SQL:443. Competing requests involving different partners therefore share the affected account lock.

10. **RESOLVED, round-one #10.** SQL:430 limits reciprocal acceptance to pending requests younger than 14 days. SQL:436 separately retains the 30-day repeat-request restriction.

11. **RESOLVED, round-one #11.** `ovu-friends.js:278` retains “Turn Plaza friends off” in the paused view. The withdrawal action remains available without removing the moderation hold.

12. **NOT RESOLVED, minor, round-one #12, partially fixed**, `tools/db/plaza_friends_dryrun.sql:281`: **The false-positive assertion defect is fixed, but the requested concurrency coverage remains absent.** NULL now fails, all 53 expected checks are required, and expiry/account-switch/failure cases were added. However, checking `pg_locks` within one transaction does not exercise competing transactions. The account-switch smoke test at `tools/e2e_smoke.py:726` checks that an old form sends nothing, but misses the retained private display reproduced in finding 2. **Smallest fix:** add isolated two-session race tests and assert immediate sheet/cache clearing on an actual cross-tab switch.

New findings:

13. **Major**, SQL:308: **Withdrawing the 18+ attestation does not serialize against social writers.** The consent trigger locks only for `social/withdraw`. An `age_18/withdraw` can therefore commit after `social_note` passes eligibility at SQL:524 but before it inserts at SQL:529. Acceptance has the same exposure. **Smallest fix:** make age-attestation withdrawal acquire the same account lock, with writers checking eligibility after acquiring it.

14. **Major**, SQL:617: **Concurrent staff decisions can leave a dismissed report attached to an active pause.** Both calls can read `open` before either acts. Pause acquires the account lock later; dismiss takes no account lock and updates by ID without rechecking status. One call can dismiss the report while the other creates a hold and returns success. **Smallest fix:** serialize all decisions consistently, then reread and validate the report before applying effects; guard the final status update.

15. **Minor**, SQL:539: **Paused and age-withdrawn accounts can still mutate note state.** `social_read` checks authentication only, allowing direct calls to mark notes read despite failing the social/18+/pause gate. **Smallest fix:** acquire the account lock and require `social.ok(uid)` before updating.

Verification: **348 core checks passed**. The cross-tab disclosure and automatic retries were reproduced using the actual modules with in-memory mocks. SQL races are source-derived, not live concurrency reproductions; PostgreSQL documents the relevant [snapshot behavior](https://www.postgresql.org/docs/current/xfunc-volatility.html). I did not rerun the live database dry run or browser smoke suite. No files changed.

Design disagreements: `docs/design/2026-10-19-plaza-chat-friends.md:73` now addresses indefinite retention through daily cleanup, but deletion can still occur almost a day after the stated 30-day limit. Disclose that bound. Also, line 19 promises requests lapse after 14 days, while SQL:562 returns sent requests for 30 days and `ovu-friends.js:299` calls them “Waiting for an answer.” Keep the 30-day anti-repeat marker separate from the 14-day pending display.

