# Friends and kind notes in the plaza (19 October 2026, design note; phase 1 built on `claude/plaza-friends`)

Jamie: "We can have chat and able to add friends...."

The plaza groups (PR #4, `2026-10-19-plaza-servers-and-hosts.md`) count people and show nobody. Friends and chat are
the first time one person's choices reach another person's screen, inside groups that are about health (Trying to
conceive, PCOS, Menopause, and Everyone). So this note settles who can see whom, what can be said, how harm is stopped,
and what is kept, before anything is built. The game plan's rules apply throughout: 18+ only, no real names, no real
location, friendship is platonic, hearts come only from logging.

## 1. Decisions

| Question | Decision | Why |
|---|---|---|
| Who can be seen | Only people who turned on **Plaza friends** and made a **plaza card** (a name she picks and one of the avatar looks). You see cards in your group only if your own card is on. | Mutual: nobody watches without being seen. Without a card the plaza stays as it is today, counts only. |
| Where | Only people in **the same group at the same time** (both checked in within 75 s). | Being in PCOS is health information. Showing it only to people who are in PCOS at that moment adds little; showing it to anyone else would add a lot. |
| What others see | Plaza name, look, and whether you are already friends or have asked. | Nothing else exists to show: no photo, no bio, no account name or email, no diary, no cycle, no group history, no online status. |
| Friend requests | Tap a person in your group, then **Ask to be friends**, with an optional preset hello. Only while both of you are in the same group. | Requests need a shared moment, so handles cannot be harvested and sent requests later from anywhere. |
| Answering | Accept or Not now. **Not now is silent**: an ask leaves her list after 14 days; the sender sees "asked" for 30 days from sending whatever happened, and cannot ask again in that time, so a decline looks the same as no answer. If you ask someone who already asked you, you are simply friends. | Saying no should cost nothing. |
| Unfriend | Either side, at any time, silent. The notes between you are deleted. | |
| Block | On every card and every note. Silent and two-way: neither sees the other in any group, requests and notes stop, friendship and pending requests end. Blocks stay until you remove them or delete your account, even if you turn Plaza friends off. | Her safety settings must outlive a pause. |
| Talking, phase 1 | **Kind notes between friends, from a set list of phrases only.** No free text anywhere. Strangers can send only a friend request (with an optional preset hello). | A fixed list cannot carry harassment, contact details, medical advice or a crisis disclosure that nobody is there to answer. |
| Talking, later | Phase 2: preset speech bubbles in the group (everyone there sees them). Phase 3: short free text between friends, only after the moderation in section 4 is live and reviewed. Group free text comes last, with the hosts. | Free text in health groups brings medical misinformation, self-harm disclosures, harassment and contact sharing; each needs a working answer first. |
| Report | On every card and every note, with preset reasons and an option to block in the same step. Staff review it. | No free-text reasons in phase 1, so a report cannot carry someone's health story. |
| Hearts, meters | **None.** No hearts, streaks, counts, read receipts or "seen" for anything social. | Hearts come only from logging (Jamie). Counts invite spam and comparison. |
| Age | 18+ attested on the account (consent purpose `age_18`) is required by every social call. A phone with a legacy under-18 answer cannot make a card. | Rhythme is 18+ (game plan 4.3). |
| Consent | A separate, account-level purpose **`social` ("Plaza friends")**, off by default, recorded in `consent_events` together with the card in one step. Turning it off deletes the card, friendships, requests and notes at once. | Others seeing her is a new purpose; it cannot ride on cloud backup or the group sheet. |

## 2. What each person sees

- **Without a card:** the plaza as today (counts, the sample neighbours, the noticeboard). The group sheet offers "Make a plaza card to see people here".
- **With a card, in a group:** up to eight real people from her group stand on the plaza (friends first), each with a nametag; anyone beyond eight is listed in the group sheet under "People here". The sample neighbours step aside while real people are visible, so a sample is never mistaken for a person. Tapping a person opens her card: name, look, and the buttons that fit (Ask to be friends, Asked, Friends, Send a kind note), plus Block and Report.
- **Friends sheet** (You, "Plaza friends", and a button in the group sheet): requests to answer, friends (send a note, unfriend, block, report), notes received in the last 30 days (newest first, each with Report), asks you sent, blocked people (Unblock), your card (change name or look, hide from groups, turn Plaza friends off).
- **Coming back to the room:** if a request or a note arrived, one quiet toast ("Someone asked to be friends" or "A kind note from Mei"), and a small dot on the group pill. No push notifications in phase 1.

## 3. Mindfulness cues

Every social action carries one short line before the button, never a delay the person has to wait out:

| Action | Cue |
|---|---|
| Making a card | "Pick a name that feels like you, not your real one. Nothing about your diary travels with it." |
| Asking to be friends | "A friend here is someone you would share a bench with. Ask kindly, and let her answer in her own time." |
| Accepting | "Welcome her in. Friendship here goes at its own pace." |
| Not now | "It is fine to say no. She will not be told." |
| Sending a note | "Before you send, one slow breath. Picture her reading it." |
| Receiving a note | "Let it land. You do not have to reply." |
| Block | "Your peace comes first. She will not be told." |
| Report | "Thank you for looking after the plaza." |
| Unfriend | "Letting go is allowed. She will not be told." |

## 4. Moderation

- **No free text in phase 1** except the plaza name. The name is checked on the server (the phone gives the same answer instantly): 2 to 20 letters, digits, spaces, apostrophes, hyphens or dots; no links, emails, handles or digit runs that look like contact details; not Rhythme, staff, admin, moderator, Erin, Luna, host or support; a short word list for slurs and sexual terms. The list lives in the database so staff can extend it without a release.
- **Rate limits on the server:** 10 friend requests a day and 20 waiting at once; 200 friends; 60 notes a day, 20 a day to one friend, one every 5 seconds; 20 reports a day; 6 card changes a day.
- **Staff review** through `admin_social_reports` (owners and analysts read) and `admin_social_decide` (owners decide), both audited through `staff.require` like every staff call. Staff see the report number, reason, time, the reported card (name, look, a short form of its handle), the phrase if it was about a note, how many open reports that card has, and the reporter's card. Staff never see account ids, emails, groups, diaries or other notes. Decisions: dismiss, pause Plaza friends for 1 to 365 days (the card disappears from groups and nothing social works), or remove the card (she can make a new one). Each decision closes every open report on that card.
- **Later, before free text:** the word list on every message, links and phone numbers refused, 200 characters, one message every 3 seconds and 100 an hour, a first-contact safety line, a resource card when a message mentions self-harm ("If you are in danger now, call your local emergency number"), staff alerting for repeated reports.

## 5. Data, retention and deletion

| Data | Who sees it | Kept |
|---|---|---|
| Plaza card (name, look, hidden or not, pause date) | Her; people in her group while both are there; her friends | Until she turns Plaza friends off, removes her account, or staff remove the card |
| Handle (random id on the card) | The phones above; staff in short form | With the card; a new card gets a new handle |
| Friendship | The two people | Until either ends it, blocks, or turns Plaza friends off |
| Friend request | The two people | Shown to her for 14 days; kept 30 days from sending whatever the answer, so the sender sees "asked" and cannot ask again in that time |
| Ask cooldown (who asked whom, when, until when) | Nobody; the server reads it for the 30-day "asked" rule and the 20-ask quota | 30 days from the ask; a block does not delete it; turning Plaza friends off does |
| Kind note (phrase id, time, read or not) | The two people | 30 days (deleted at the next daily clean-up, so within a day after); deleted when the friendship ends |
| Block (and the name it had then) | The person who blocked | Until she unblocks or deletes her account |
| Report (snapshot of the card, phrase, reason) | Staff | Open until decided; one year after the decision; the reporter is removed if her account is deleted |
| Rate counters (kind, time) | Nobody | Two days |
| Consent events `social` and `age_18` | Her; the server | As every consent record (account life plus the limitation period, per the game plan 4.4) |

Clean-up of old rows runs inside the social calls and the staff calls, and also once a day at 03:17 Singapore time from a pg_cron job (`rhythme-social-sweep`), so the 30-day promise holds even when nobody uses the plaza. The migration enables the pg_cron extension for this; it is the project's first scheduled job. Account deletion removes everything above through the account's foreign keys (reports keep the snapshot with no account attached).

What never leaves her phone because of this feature: the diary, cycle, symptoms, food, sleep, Luna's readings, the account's own display name and email, which groups she has been in.

## 6. Consent and the notice

New purpose `social`, title **Plaza friends**, off by default, recorded at the moment she makes her card (method `jit`) and withdrawn when she turns it off. Proposed words (Jamie approves before release):

> **Plaza friends.** While you are in a plaza group, people in the same group who also turned this on can see your plaza name and look, and that you are in that group with them. They can ask to be your friend, and friends can send each other kind notes from a set list. Your diary, your cycle, your account name and your email are never shown. Notes are deleted after 30 days, at the next daily clean-up. You can turn this off at any time; your card, friends, requests and notes are then deleted. People you blocked stay blocked.

The privacy notes gain the same paragraph under a "Plaza" heading, and the group sheet's line "Other people and Rhythme staff see only the number, never who" becomes "Unless you turn on Plaza friends, other people see only the number, never who. Rhythme staff see only the number."

The `consent_events.purpose` check gains `social`. The consent rebuild (PR #3) lists purposes in `ovu-consent.js`; when both are merged, `social` joins its list (shown, off, with the words above) so the You sheet shows it with the others. Until then the friends module records it on the server itself and mirrors the event into the phone's consent log when that log exists.

## 7. Phase 1 as built (19 October 2026)

- **Server** (`supabase/migrations/20261019130000_plaza_friends.sql`, **written and dry-run, not applied**): tables `social_profiles`, `social_holds`, `social_requests`, `social_friends`, `social_blocks`, `social_notes`, `social_phrases`, `social_words`, `social_rate`, and `staff.social_reports`, all closed to the app's roles (no table grants; RLS on). Calls for a signed-in person: `social_me`, `social_card_save`, `social_off`, `social_people`, `social_ask`, `social_answer`, `social_unfriend`, `social_block`, `social_unblock`, `social_note`, `social_read`, `social_inbox`, `social_report`. Staff: `admin_social_reports`, `admin_social_decide`, owned by `rhythme_staff_fn`, audited.
- **Phone** (`ovu-friends.js`): the card sheet, people in the group on the plaza (through the existing `OvuCommunity.neighbours()` seam), a person's card, the friends sheet, preset notes with the cue line, report and block, the inbox check on arrival and every minute while the app is open and the card is on.
- **Staff** (`admin.js`): a Reports card on the Queue tab.

## 7a. Review record (Codex, read-only)

**Round one (19 Oct): REJECT, 12 findings, all fixed in the second cut.**

| # | Finding | Fix | Proof |
|---|---|---|---|
| 1 | A form left open on another phone could re-grant a withdrawn choice | Turning on needs the box ticked on this form (`p_opt_in`); 18+ only from its own box; an edit names its card (`p_expect`), a new card names none | dry run `no_opt_in_refused`, `edit_needs_its_card`, `stale_edit_after_withdraw`; smoke sends the ticked boxes only |
| 2 | Replies and open forms could act for the next account | Every request carries its account; it is cancelled before sending and dropped on reply if another account is signed in; social sheets close on any account change | smoke: a form sends nothing after a switch; a late reply is not kept |
| 3, 4, 9 | Note/accept could race a block; writes could race a withdrawal; capacity checks could race | One lock per account (`social.lock`), both taken in key order before any check; withdrawal (trigger) and staff pauses take the account's lock; the inbox shows notes only from unblocked friends | dry run `locks_pair`, `locks_withdrawal` (read from `pg_locks`), `inbox_only_friends_notes` |
| 5 | Blocking a remembered handle looked up her current card | The Blocked list copies a card only if the blocker could see it at that moment (friends, a request between them, or both in the same group); otherwise "Someone" | dry run `block_snapshot_only_if_visible` |
| 6 | A hidden person could probe a friend's group | Hidden callers cannot ask | dry run `hidden_cannot_ask` |
| 7 | A failed fetch left last group's people on the plate | People belong to the visit they were fetched for; a new group or a failure clears them at once; after a failure the next try waits until the plaza confirms the visit | smoke: failure clears and recovers after a check-in; a group change clears before any reply |
| 8 | The 20-ask limit could reveal a silent decline | Declined asks keep their slot for 14 days, like unanswered ones | dry run `declines_keep_quota` |
| 10 | Asking back accepted an ask past its 14 days | Asking back accepts only an answerable (14-day) ask | dry run `reciprocal_needs_14_days` |
| 11 | A paused account could not turn Plaza friends off | The paused view keeps Turn Plaza friends off | smoke: paused view shows it |
| 12 | Null assertions could pass the dry run | Every expected check must be present and true; a null fails | `count 53 / expected 53`, `missing null` |
| Design | Retention ran only on use | Daily pg_cron clean-up | dry run `daily_cleanup_scheduled` |

Not shown by these tests: two live sessions racing (a single transaction cannot); the lock order is in the source and
`pg_locks` shows both accounts held after a call.

**Round two (19 Oct): REJECT. Stopped here for Jamie (AGENTS gate 6: a second failed review on the same findings).**
Resolved: 1, 3, 4, 8, 9, 10, 11. Still open, with the smallest fix proposed and **not applied**:

| # | Finding (round two) | Proposed fix |
|---|---|---|
| 2 (blocker, repeat) | Signing into another account in another tab does not reach this tab's listener, so the last account's card and friends stay on screen until something else changes it | Listen for the `storage` event on `ovumind_auth_v1` and check the signed-in id on every timer tick; either runs the same reset (cancel, clear, close the sheet) |
| 5 (repeat) | Blocking someone who blocked you, while in the same group, copies her current card into your Blocked list | `social.visible` also requires no block either way and both accounts eligible; otherwise "Someone" |
| 6 (repeat) | A hidden person can learn whether a remembered handle is in a group by blocking it (named or "Someone") | The co-presence branch requires both cards shown (mutual), as `social_people` does |
| 7 (repeat) | After a failure, people and inbox checks still retry on their own (after a plaza check-in, and every minute) | Keep a failure flag for both until she acts (opens the plaza sheet, the friends sheet, or walks back in); no timer or check-in clears it |
| 12 (repeat, partial) | No two-session race test; the cross-tab switch is not in the smoke run | Two-session tests need a second connection (a Supabase branch, which costs money, or a local Postgres); add the cross-tab case to the smoke run with the fix for 2 |
| 13 (new) | Withdrawing 18+ is not serialised with friends calls | The consent trigger also takes the account lock for `age_18` withdrawals |
| 14 (new) | Two staff decisions at once can dismiss a report while the other pauses | Lock the report row (`for update`) and the account first, recheck `open`, and guard the final update |
| 15 (new) | `social_read` works while paused or after 18+ is withdrawn | Lock and require `social.ok` |
| design | Daily clean-up means deletion up to a day after 30 days; an unanswered ask leaves her list after 14 days but the sender sees "asked" for 30 | Say "within a day after 30 days"; keep the two windows as designed and word them that way (section 1 says so) |

**Round three (20 Oct, Jamie: "Yes, apply the round-three fixes ... and get a third Codex review").** Applied:

| Round two # | Fix | Proof |
|---|---|---|
| 2 | Account changes from another tab arrive through the `storage` event, and every timer tick checks the account; both run the same reset (cancel, forget, close the sheet) | smoke: another tab signs in, this tab's sheet closes and the card is gone at once; what follows asks as the new account |
| 5, 6 | A block copies a card only when both accounts are eligible, neither has blocked the other and, in a group, both cards are shown | dry run `block_snapshot_not_if_blocked`, `block_snapshot_not_if_hidden` |
| 7 | One hold: after any automatic request fails, nothing is asked again on its own (no timer, check-in, render or return to the app) until she opens Plaza friends, taps the group pill or walks into the plaza | smoke: after a failure, a check-in, both timers and a return to the app send nothing; a tap tries again |
| 12 | Two-session races on a local Postgres, each confirmed waiting on a lock; with the lock removed 7 of 8 go wrong | `tools/db/race_test.py --mutate` |
| 13 | Withdrawing 18+ takes the account lock and ends Plaza friends like withdrawing it | dry run `age_withdraw_deletes`; race `age withdraw vs accept` |
| 14 | Staff decisions take the account lock, then the report row (`for update`), recheck it, and guard the final update | dry run `decide_rechecks`; race `staff decisions` |
| 15 | `social_read` takes the lock and needs Plaza friends on | dry run `read_needs_ok` |
| design | Notes "are deleted after 30 days, at the next daily clean-up"; an ask shows to her for 14 days and stays "asked" for the sender for 30 | section 1, section 5, the consent words, the privacy paragraph, the friends sheet |

Not covered: the browser's own cross-tab behaviour for other modules (the plaza and sign-in UI do not listen for
another tab either; that is PR #4's and the account module's), and real network partitions.

**Round three review (20 Oct): REJECT. Stopped here for Jamie: the retry hold (round two #7) failed a third time.**
Resolved: round two 2, 5, 6, 12, 13, 14, 15 and both design notes. Open, with the smallest fix proposed and **not
applied**:

| # | Finding (round three) | Proposed fix |
|---|---|---|
| 4 (repeat of #7) | After an action (Accept, report, unfriend, block, unblock), a failed inbox refresh goes "back", and going back re-opens Plaza friends, which counts as her own act and clears the hold, so it fetches again on its own; a failed "mark read" is not held | Keep `open()` for her own taps only; going back after an action re-draws the sheet from what is known and, on a failure, shows "could not reach" without asking again; route a failed `social_read` through the hold |
| 9 (new) | Block then unblock deletes the 30-day ask record, so she can ask again at once after a "not now" | Keep a small cooldown record (who asked whom, until when) that blocking does not delete, kept 30 days, and say so in the data table |
| 10 (new) | An old or declined ask still lets the person who received it look up the asker's current card by blocking her | `social.visible` follows the inbox: an incoming ask counts only while pending and under 14 days; her own outgoing ask counts for 30 days |
| 11 (new) | The mutation run counts a race as "gone wrong" when the second session merely did not wait | Check waiting and the outcome separately; count a mutation only when the response or the rows are wrong, then restate the "7 of 8" |

**Round four (20 Oct, Jamie: "Yes, apply the four round-four fixes ... and get a fourth Codex review").** Applied:

| Round three # | Fix | Proof |
|---|---|---|
| 4 (the hold) | Two ways into the friends sheet: `open()` is her own tap (the only one, with the group pill and walking into the plaza, that lifts the hold) and fetches; `show()` redraws after something she did from what is known and never fetches. Every "back" uses `show()`. A tap that sends something lifts the hold for that one request; whatever follows may fail and hold again. A failed "mark read" holds, and nothing marks read while held. The sheet says "Could not reach Plaza friends" with Try again | smoke: a failed mark-read holds and is not resent; Accept then a failed refresh redraws, with no second refresh, no `social_me`, nothing from a timer or a return to the app; Try again asks |
| 9 | `social_cooldowns` (who asked whom, until when) is written with every ask, read by the 30-day rule and the 20-ask quota, deleted by friendship or turning off, never by a block; a daily sweep drops expired rows | dry run `cooldown_survives_block` (not now, block, unblock, ask: nothing sent, still "asked"), `quota_survives_block` |
| 10 | `social.visible` follows the inbox: her own ask for 30 days; an ask to her only while pending and under 14 days | dry run `visible_follows_inbox` (declined and expired incoming asks give "Someone", her own ask gives the card) |
| 11 | Each race returns its outcome (answers and rows) and whether the second session waited, separately; the mutation run counts only wrong outcomes | `race_test.py --mutate`: 7 of 8 end with wrong answers or rows without the lock; the staff race stays right on its row lock |

**Superseded (20 Oct, 11:00).** While round four was being checked, the same four findings were fixed on another branch
(an ask log in place of the cooldown record), reviewed, dry-run, applied live as migration `20261020013954 plaza_friends`
and merged to main in momominibot/ovumind.github.io#13, which closed #10. This round is kept on `claude/plaza-friends`
for the record and was not sent for a fourth review. Checked against main's migration on a local Postgres: block then
unblock no longer resets the ask wait (fixed on main). Two differences remain on main: turning Plaza friends off keeps
her ask log rows for up to 30 days while the privacy page and the card's words say her card, friends, requests and
notes are deleted (keeping them is what stops off-and-on from re-asking someone who said not now, which this round's
cooldown record did not stop, so the words should say so rather than the rows go); and the people list reads "asked"
from requests only, so after a block and unblock it offers Ask again, which then answers "asked" and sends nothing.

## 8. Phases

1. Cards, people in your group, friend requests, friends, preset kind notes, block, report, staff review (this branch).
2. Preset speech bubbles in the group, a friend's "in the plaza now" (her choice, off by default).
3. Free text between friends behind the section 4 safeguards; reviewed again before it ships.
4. Group free text with the hosts, after the host design in the plaza note.
