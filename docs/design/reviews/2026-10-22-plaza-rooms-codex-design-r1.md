BUILD WITH CHANGES

1. **P0: Live publication has no operational safety gate.**  
   **Design lines 104-109, 135:** “Who moderates and at what hours: open.” Dangerous treatment advice, harassment or self-harm encouragement can reach readers before anyone reports it. Three reports cannot protect a room with only two people. The earlier `2026-10-21-today-tabs-and-channel-chat.md:42-47` required premoderation and known staff coverage.  
   **Smallest fix:** keep live free-text publication off. Start with staff-approved submissions, with named coverage, urgent-report handling and an audited removal path before enabling live mode. The cited [JMIR study](https://formative.jmir.org/2026/1/e87782/) supports validation alongside moderation, not replacing moderation with scripted kindness. [Samaritans’ moderation guidance](https://media.samaritans.org/documents/Implementing_effective_moderation_for_self-harm_and_suicide_content_FINAL.pdf) also requires effective human oversight.

2. **P0: “Post anyway” and the phone’s care flag are unsuitable publication controls.**  
   **Design lines 88-94; `ovu-orb.js:229`:** the matcher detects personal warning signs, not harmful content. Local probes returned `null` for “Stop your HRT and double your supplement dose.” It also flagged a past recovery disclosure as `SELF_HARM_NOW`. A modified client can omit the flag entirely.  
   **Smallest fix:** remove unrestricted Post anyway for self-harm/emergency matches in this unstaffed phase. Keep the draft and worldwide care help private. Offer revision or a clearly described moderation route. Enforce publication holds server-side from submitted text. Do not permanently ban every self-harm mention: recovery, support-seeking and harmful instructions need different treatment, consistent with [Samaritans’ content-policy guidance](https://www.samaritans.org/about-samaritans/research-policy/internet-suicide/guidelines-tech-industry/developing-content-policy/).

3. **P1: “Host” implies attention that nobody has provided.**  
   **Design lines 86-94:** “Thank you for telling us” beneath a distress disclosure can look like a person has read it. A Host badge does not explain that it is a fixed automatic response.  
   **Smallest fix:** label it **Automatic support reminder** and say: “This reminder is automatic. No person has reviewed this message.” Prefer an attached reminder over a participant-like chat reply. Only the server may create host/system messages; clients must not supply an authoritative `host` flag.

4. **P1: The announcement phrase list would refuse grief.**  
   **Design lines 95-99:** `due date`, `gave birth`, `positive test` and `weeks along` occur in “My due date would have been today,” “I gave birth but my baby died,” and descriptions of miscarriage. Announcement paraphrases can still evade the list.  
   **Smallest fix:** use these phrases to trigger a private warning or moderation hold, with explicit history, negation and grief examples. Change “never show” to a rule enforced through moderation, rather than a phrase-list guarantee. **No Wins room in After a loss is coherent**, but narrow “no success posts” to pregnancy/birth announcements so gratitude and recovery remain welcome.

5. **P1: The inherited word list blocks legitimate health conversations.**  
   **Design line 105:** “the plaza word list applies.” In `20261019130000_plaza_friends.sql:61-68`, that list was written for names and includes `sex`, `rape`, `kill` and `suicide`. It rejects assault disclosures and sexual-health questions without catching the dangerous advice above.  
   **Smallest fix:** create separate message rules that allow clinical and support vocabulary while holding harmful context. Explicitly prohibit reuse of the complete name validator, which also has name-specific length and digit restrictions.

6. **P1: Keep separate `plaza_chat` consent, but specify how stale grants are refused.**  
   **Design lines 53-55, 122-124:** the existing `social` notice promises preset notes, so it does not adequately describe publishing personal free text. The new purpose is appropriate. However, an account lock alone does not prevent an old consent form from re-enabling chat after withdrawal elsewhere.  
   **Smallest fix:** require fresh explicit acceptance, the expected card handle and expected consent revision. `plaza_say` must never grant consent implicitly. Define parent withdrawal: withdrawing `social` or `age_18` ends chat, removes messages and requires fresh chat acceptance after a new card is created.

7. **P1: The Room chat notice promises more deletion and less access than the design delivers.**  
   **Design lines 57-60 versus 110-111:** reported text survives withdrawal and remains until a decision plus one year. Hourly cleanup can retain ordinary rows for nearly 25 hours. With no reviewer, “until decided” is unbounded. Premoderation would also contradict “staff see a message only if someone reports it.”  
   **Smallest fix:** disclose room expiry, cleanup timing, the report-record exception and moderation access separately. State that later group members can read the preceding 24 hours. Define a maximum retention period for unresolved reports. Enforce the 24-hour visibility cutoff independently of cleanup.

8. **P1: The RPC authorization contract is incomplete.**  
   **Design lines 48-66, 116-124:** “authenticated only” is insufficient. Existing `social.ok()` checks consent, adulthood, card existence and pause, but deliberately does **not** check `hidden` (`plaza_friends.sql:211-218`).  
   **Smallest fix:** explicitly require current eligibility, a shown card, exact live group visit and applicable open flags for feed/join/send; require `plaza_chat` for sending. Filter two-way blocks before returning bodies. Define hiding/pausing as suppressing that author’s existing room messages. Close every new table and sequence with the same RLS/revoke contract as the friends migration. Resolve the table’s apparent permission for under-18 signed-in users to see rooms against line 65.

9. **P1: The two proposed locks do not serialize sending with departure.**  
   **Design lines 125-126:** saying takes the account lock, while existing group join, leave and sweep use the separate membership lock (`20261019110000_plaza_visits.sql:49,82,100`). A send can validate a visit, another phone displaces it, then the send commits. Room joining can similarly race withdrawal or pause.  
   **Smallest fix:** specify one lock order, account before membership, and hold both through fresh authorization and the room write. Acquire message/report row locks afterward wherever those operations also need account locks.

10. **P1: Group visits cannot identify individual room entries.**  
    **Design line 118:** room presence has a group visit but no room-entry token. The existing visit survives repeated same-group joins (`plaza_visits.sql:63-69`). A delayed Leave from room A can therefore remove a later A re-entry during the same visit.  
    **Smallest fix:** issue a room-entry token, require it on leave/send, and make join retries idempotent. Enforce one current room membership per account. Count only eligible memberships attached to the exact unexpired group visit under the capacity lock. Changing Today/Channel tabs does not itself end the group visit.

11. **P1: Chat must inherit the existing account and request-isolation protections explicitly.**  
    **Design sections 4 and 6; `ovu-friends.js:156-175,223-254`:** the friends client binds requests to an account, rejects late responses and clears UI after cross-tab account changes. The design does not extend that contract to chat drafts and feeds.  
    **Smallest fix:** bind every request, response and composer to account, group visit, room and room-entry token. Clear sensitive UI on account change, displacement or eligibility loss. Discard late replies after leaving or switching rooms, including responses that arrive after token refresh.

12. **P1: A public care marker must not reveal private profile-derived information.**  
    **Design lines 89-91, 120:** `urgent(text, profile)` uses private pregnancy and life-stage fields. Locally, “I am spotting” returned no card with an empty profile but `POSTMENO_BLEED` with a postmenopausal profile.  
    **Smallest fix:** keep the full profile-aware care result exclusively on the writer’s device. Public moderation markers must derive only from the submitted message. Never publish its private-profile-derived trigger, code or tailored care copy.

13. **P1: Report counting and staff resolution need a complete message-level contract.**  
    **Design lines 106-109, 126:** locking the message before counting is sound, but report authorization, uniqueness and resolution are unspecified. Existing `staff.social_decide()` supports dismiss, pause and card removal, not removing/restoring one message.  
    **Smallest fix:** authorize reports against a message the reporter could receive; copy evidence server-side; count each authenticated account once per message. Add audited message remove/restore decisions and define dismissal behavior. Poll responses must retract messages already displayed after hiding, blocking, withdrawal or expiry. An insert-only feed would leave harmful text visible.

14. **P2: Polling is reasonable, but the load and away-state rules need correction.**  
    **Design lines 70, 78-80:** at 24 active viewers, the proposed three polling schedules total approximately **9.6 requests/second per group**, before existing presence/friends calls. Also, “nothing … out of the plaza” contradicts showing fresh group counts away from it.  
    **Smallest fix:** retain polling initially, with bounded feeds, one request in flight per poller, deadlines and no overlapping refreshes. Permit only count polling away from the plaza. Realtime can wait; Supabase Broadcast/Presence authorization has [connection-cached permissions](https://supabase.com/docs/guides/realtime/authorization), so switching transport would require additional revocation handling.

15. **P2: Channel labels obscure audience, membership and availability.**  
    **Design lines 62-77, 130-131; `ovu-today.js:50`:** “12 of 12, full” suggests twelve readers, but other group members can peek without joining. “You are in this group” currently also describes a remembered choice while absent. Tab changes can unexpectedly end room membership and strand a draft.  
    **Smallest fix:** distinguish **Saved group**, **In the plaza** and **Joined room**. Label room counts “joined” and explain that other group members can read. Define draft behavior on tab/group changes. Keep the missing-migration fallback, but show rooms only after a valid capability response and enabled flags; malformed or incompatible responses must also hide the feature and clear any old feed.

Read-only review completed using source inspection and in-memory matcher probes. No files edited or migrations applied.

