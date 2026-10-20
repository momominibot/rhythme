VERDICT: REJECT

Reviewed `7a4a139..0f43d4e`. SQL references below mean `supabase/migrations/20261019130000_plaza_friends.sql`.

1. **RESOLVED, round-two #2.** `ovu-friends.js:523` listens for cross-tab authentication changes. The common reset at `:246` clears card, inbox and people, invalidates pending generations and closes the social sheet. Timer callbacks also check account identity at `:243`.

2. **RESOLVED, round-two #5.** SQL`:279` requires both accounts eligible and no block in either direction before copying current card details. The previously reproduced blocked-person lookup is closed.

3. **RESOLVED, round-two #6.** SQL`:283` requires both cards shown in the co-presence branch. A hidden caller cannot use that branch to obtain a named block snapshot.

4. **NOT RESOLVED, major, repeated round-two #7**, `ovu-friends.js:468`: **A failed inbox refresh after Accept immediately retries automatically.** `loadInbox(true).then(back, back)` invokes `back` on failure; `back` calls `open()` at `:438`, which clears the failure hold at `:279` and fetches again.

   Reproduced using the actual module with in-memory mocks: one Accept click produced `social_answer → social_inbox [failed] → social_me → social_inbox`, ending with `held:false`, without another user action. Reports, unfriend, block and unblock have equivalent rejection paths. Automatic `social_read` failures are also swallowed without holding at `:324`.

   **Smallest fix:** preserve the hold on rejection, separate internal navigation from explicit user retry, and route automatic read failures through the same hold.

5. **RESOLVED, round-two #12, for the requested coverage.** `tools/db/race_test.py:78` now opens competing transactions and observes lock waiting. `tools/e2e_smoke.py:732` uses a second browser tab and checks sheet closure, cleared card state and subsequent account tokens. The separate mutation-proof defect is finding 11 below.

6. **RESOLVED, round-two #13, by source inspection.** SQL`:314` handles both social and age-attestation withdrawal, takes the shared account lock and deletes social data. Writers check eligibility after acquiring that lock.

7. **RESOLVED, round-two #14, by source inspection.** SQL`:629` locks the account, locks and rereads the report, then rejects already-decided reports. Status updates also require `status = 'open'`.

8. **RESOLVED, round-two #15.** SQL`:545` locks the account and requires `social.ok(uid)` before marking notes read.

9. **NEW, major**, SQL`:299`: **Blocking and unblocking bypasses the 30-day request restriction.** A asks B, B declines, then A blocks and unblocks B. Blocking deletes the request and its timestamp. While co-present, A can immediately ask again because the cooldown check at `:442` finds no surviving marker. The daily limit remains, but B can receive repeated requests after declining.

   **Smallest fix:** retain a minimal cooldown record independently of visible requests and block deletion. Add a decline → block → unblock → ask regression.

10. **NEW, minor**, SQL`:281`: **Expired or declined incoming requests still authorize a current-card lookup.** B receives A’s request, declines it or lets 14 days pass, and they are no longer friends or co-present. Before day 30, B can block A’s remembered handle and receive A’s current name/look. `social.visible` accepts requests in either direction for 30 days, although incoming inbox access requires a pending request younger than 14 days at `:567`.

    **Smallest fix:** mirror the directional inbox rules in `social.visible`, or copy only a previously authorized snapshot.

11. **NEW, minor**, `tools/db/race_test.py:189`: **The mutation test can claim a reproduced data race when the data remained correct.** Every safety predicate includes `w and …`, for example `:124`. Removing the lock can therefore make the predicate false solely because the second session did not wait. Lines `:189–191` count that as an unsafe outcome. Supplying correct responses and row counts with `w=False` makes the mutation assertion pass.

    **Smallest fix:** separate lock-wait assertions from persisted-outcome assertions. Require an actual incorrect response or database state to demonstrate mutation sensitivity, then reconcile the “7 of 8 go wrong” claim in `.result.md`.

Verification: **348 core checks passed**. The post-Accept retry was independently reproduced with the actual JavaScript module. SQL findings are source-derived; concurrency assessments use PostgreSQL’s [snapshot rules](https://www.postgresql.org/docs/current/xfunc-volatility.html). No databases started, live dry run or browser smoke suite rerun, or files changed.

Design notes: **Both round-two notes are RESOLVED.** Design`:67` discloses deletion within a day after 30 days; design`:19`, SQL`:567/:570` and `ovu-friends.js:315` distinguish the recipient’s 14-day window from the sender’s 30-day display. The remaining disagreement is making the anti-repeat protection depend on deletable request rows; its minimal retained metadata needs a separate, disclosed retention rule.