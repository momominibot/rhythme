# Plaza rooms and the live Channel tab (22 October 2026, design note; built after the Codex design review, section 9)

Jamie: "plaza groups i need you to go reddit and platforms to check what the women would like to talk about what kind
of community they would like to have and we will create the group forum chat", then "can this be a live chat? they
still can toggle the channel and chitchat and we will show how many are online at the moment so they can tab around to
see what others are chatting."

Evidence: `2026-10-22-plaza-groups-research.md` (sections 2 and 3). Earlier decisions this builds on:
`2026-10-19-plaza-servers-and-hosts.md` (groups, 24 each, presence by visit, the 75 s lapse),
`2026-10-19-plaza-chat-friends.md` (the plaza card, 18+, mutual visibility, block, report, staff review, one lock per
account) and `2026-10-21-today-tabs-and-channel-chat.md` (the Channel tab, and what a chat needs before it opens).

## 1. What exists today, and what does not

| Exists, live | Does not exist |
|---|---|
| Groups Everyone, Trying to conceive, PCOS, Menopause (24 each); `plaza_list`, `plaza_join`, `plaza_beat`, `plaza_leave`; a visit id per membership; counted only while she stands in the plaza | Rooms inside a group, topic channels, any message table, any typed chat |
| Plaza friends: card (name and look), consent `social` and `age_18`, block, report to staff, staff pause and remove, one advisory lock per account (`social.lock`), rate counters (`social.hit`), a word list | Hosts of any kind (the round-the-clock agents were designed, never built) |
| The Today card's Channel tab (`ovu-today.js`): the joined group, its count, today's prompt, Plaza friends | A realtime path. Every plaza screen polls RPCs (check-in 25 s, list 30 s) |

So "the existing 12-person topic channels" and "the existing 24-hour messages" in the research note were the 19 Oct
design, not code. This change builds them, for the standing rooms only.

## 2. Groups (one migration renames two and adds two; ids stay so remembered choices keep working)

| id | Name | Blurb | Rooms (kind) |
|---|---|---|---|
| everyone | Everyone | Any stage, any cycle | Chat (chat), Wins (wins), Vent (vent), Doctor visits (doctor), Cycle and PMDD (topic) |
| pcos | PCOS and endometriosis | Living with PCOS or endometriosis | Chat, Body and hair (topic), Doctor visits (doctor), Wins, Vent |
| trying-to-conceive | Trying to conceive | Planning or trying for a baby | Chat, Clinic and doctors (doctor), Small wins (wins), Vent |
| after-a-loss | After a loss | Pregnancy loss and grief. No pregnancy or birth news here | Quiet room (quiet), Remembering (quiet) |
| new-mothers | New mothers | The first year with a baby | Chat, Night feeds (topic), Mental health (topic), Wins, Vent |
| menopause | Perimenopause and menopause | Perimenopause, menopause and after | Chat, Sleep at 3am (topic), Relationships (topic), HRT and treatment (doctor), Wins, Vent |

- **Cycle and PMDD starts as a room in Everyone** (research note section 5: promote it to a group when it is busy).
- **A Wins and a Vent room in every group except After a loss.** The two rules collide there: a loss space never sees
  success posts, so it has no Wins room, and its Quiet room is where venting goes. Said on the group's door.
- **Trying to conceive keeps pregnancy news out**, as the infertility communities do: its wins room is "Small wins"
  (a kept appointment, a kind day), and its blurb says pregnancy news goes to Everyone, Wins.
- Rooms hold 12 each; the group still holds 24. A full room names the rooms in the same group that have space.
- A full After a loss suggests no other group (pointing someone grieving at Everyone, whose Wins room may hold pregnancy
  news, would be the wrong kindness). Other full groups still suggest Everyone only, as today.
- User-made rooms (anyone's own topic, 24 hours without a message closes it) are **not in this change**: a free-text
  room title is one more thing to moderate, and the standing rooms cover what the evidence asked for.

## 3. Who can do what

| Signed out | Signed in, no card or card hidden | Card shown, 18+, in the group (standing in the plaza) | ...and Room chat turned on |
|---|---|---|---|
| Groups and counts are not shown (as today) | Groups with "N here now"; rooms of her group with counts | ...plus a read-only peek at any room in her group, and one-tap Join a room | ...plus typing in the room she joined |

- Reading needs a shown card for the same reason seeing people does: nobody watches without being seen.
- Writing needs a new account-level consent purpose **`plaza_chat` ("Room chat")**, asked just in time at her first
  message and recorded by the server, because her own words reaching a room is a new purpose (the Plaza friends words
  promise "a set list" only). Turning it off deletes her messages at once. Words (Jamie approves before release):

> **Room chat.** What you type in a room is shown with your plaza name and look to the people in that group, including
> anyone who joins while it is still there. Messages can be read for 24 hours and are deleted within an hour after
> that. Some messages wait for a person on the Rhythme team to read them before they show, and staff also read any
> message someone reports; a reported message is kept with the report until it is decided (at most 90 days), then for a
> year. Do not share your real name, where you live or contact details. Rooms are peer support, not medical advice, and
> nobody watches them around the clock. You can turn this off at any time; your messages are then deleted.

(Revised after the design review, finding 7. The form names the card it was opened with and the last Room chat event it
knew, so a stale form cannot turn chat back on; withdrawing Plaza friends or 18+ also withdraws Room chat.)

- **Chat lives in the plaza.** She is counted in a group only while she stands in the plaza (unchanged), so rooms, peeks
  and typing work while she is there; the Channel tab is the place she reads and types (it sits under the scene). Away
  from the plaza the tab shows the groups and their counts, and "Walk to the plaza to join the rooms".
- 18+ comes from `age_18` (as Plaza friends); a phone with a legacy under-18 answer never sees a room. Under-13
  profiles never reach the plaza card, so never a room.

## 4. The Channel tab (Jamie's "tab around")

1. **Groups strip**: every group with its door sign and "N here now" (`plaza_list`, every 20 s while the tab is shown).
   Her group is marked; in the plaza another group is one tap to switch (the existing join, with its capacity rule).
2. **Rooms of her group**: name, one-line purpose, "5 here" or "12 of 12, full", and the time of the last message.
3. **Peek**: tapping a room shows its latest messages read-only, with Join this room. Joining is one tap; a full room
   says which rooms have space.
4. **Inside a room**: the pinned help card, the room's host note (and the encounter card in doctor rooms), messages
   newest last, a box of 280 characters with Send, and on every message from someone else Report, Mute and Block.
   Leave room returns to the peek list. Changing tab or walking out leaves the room (the visit ends it anyway).
5. **Live**: the open room is asked every 4 s and the rooms list every 10 s while the tab is shown and the page is
   visible; nothing is asked when hidden, asleep, signed out or out of the plaza. (A websocket channel would be a new
   dependency and a new place to enforce the same rules; polling at this size is a few requests a second per group.)

## 5. The rules in the room (research note section 3)

- **Pinned help card in every room**: "If you might hurt yourself or you are in danger, call your local emergency number
  or go to the nearest emergency department. findahelpline.com lists free helplines in your country."
- **Host note in every room** (labelled Host): what the room is for, "lead with kindness; say what you hear before any
  suggestion", "no medical advice here: ask your doctor", and for Vent and Quiet rooms "no fixing needed".
- **Validation before advice, with no pretend host (changed after the review, findings 2, 3, 12).** Each room carries a
  fixed *Room note* (labelled, never a person): lead with what you hear, ask before offering ideas, no medical advice,
  and for Vent and Quiet rooms "no fixing needed". When her own words match the app's warning-sign rules
  (`OvuOrb.urgent`, the diary's matcher, run on the phone with her profile, which never leaves it) or the server's crisis
  list, she first sees the care card (local emergency number, nearest emergency department, findahelpline.com). There is
  no Post anyway: she may *send it for a check* (a person reads it before it shows) or keep it. The server holds crisis
  words itself, whatever the phone says; a shown crisis message carries an *automatic reminder* labelled as automatic.
  Real hosts wait for someone to stand behind them (section 8).
- **Loss spaces keep pregnancy and birth news out (finding 4)**: in After a loss and Trying to conceive rooms present-tense
  announcement phrases ("I'm pregnant", "we're expecting", "BFP", "it's a girl", "baby is here") *hold* a message for a
  person to read instead of refusing it; the phone says why first. Grief is on no list ("we lost the heartbeat", "my due
  date would have been today", "I gave birth to my son sleeping" all show). A report reason "Pregnancy or birth news in a
  quiet room" exists for what slips through. This is a rule kept by moderation, not a guarantee from a phrase list.
- **Anonymity**: plaza name and look only; no photos, no links (refused), no emails, no phone-like digit runs, no @handles.
- **Doctor rooms** (Doctor visits, Clinic and doctors, HRT and treatment) pin the encounter card: "Before you go: write
  your three questions, what you have tried, and how it affects your days. If you feel dismissed: 'What else could this
  be?', 'Please note in my record that I asked about this.', 'Can I see someone else for a second opinion?'"
- **Rate and words** (server): one message every 3 s, 30 an hour, 150 a day; the same text twice in a row in a room is
  dropped; 1 to 280 characters after trimming; a message word list of its own (slurs, solicitation, private chat apps)
  so health words ("sex", "rape", "suicide") stay allowed; treatment instructions and doses are held (finding 5).
- **Report, mute, block**: report (reasons unkind, spam, pretending, under 18, worried about her, medical advice, pregnancy
  news in a quiet room, other) sends staff the message text, the room, both cards; three reports from different people
  hide a message at once pending staff; mute is this phone only; block is the existing two-way block (neither sees the
  other's messages). Staff decisions are the existing pause and remove; removing a card deletes her messages.
- **Retention**: messages 24 hours (deleted on every room call and by an hourly job); room membership ends with the
  visit; reports keep the message text until decided, then a year (as friends reports).
- **Kill switches**: per room (`open`), per group (`open`), and a global `chat_on` flag; a missing flag reads as off.

## 6. Data (new migration, not applied until Jamie approves)

- `plaza_servers`: two names changed, two rows added, `quiet boolean` (After a loss).
- `plaza_rooms` (id, server, name, blurb, kind, capacity 12, sort, open, no_news).
- `plaza_room_presence` (user_id, server, visit, room, joined_at): valid only while the same visit is present.
- `plaza_messages` (id, room, server, author references the card, so withdrawing Plaza friends or a removed card deletes
  them; handle, name and look at the time, body, care, host, hidden, at), indexed by room and time.
- `plaza_news_phrases`, `plaza_host_lines`, `plaza_flags`.
- Calls (all `security definer`, authenticated only): `plaza_rooms_list`, `plaza_room_join`, `plaza_room_leave`,
  `plaza_room_feed`, `plaza_say`, `plaza_chat_on`, `plaza_chat_off`, `plaza_report_message`. Consent purpose
  `plaza_chat` added to the check; the consent trigger deletes her messages on withdrawal of `plaza_chat`.
- Locks: room join takes the plaza membership lock (capacity), saying takes her account lock (withdrawal, pause and rate
  limits are serialised with it), a report locks the message row before counting reports.

## 7. Until the migration is applied

The phone asks `plaza_rooms_list`; a PGRST202 (function missing) hides the rooms part of the tab and keeps today's
Channel tab exactly as it is. The plaza sheet keeps "There is no open chat" until the rooms answer.

## 8. Decisions for Jamie (the 21 Oct note asked for them; Jamie's "live chat" answers the first)

1. Applying the migration (it starts in **review** mode: the rooms, counts, peeks and joining are live at once, and each
   message shows after someone on the team taps Show in the staff Queue).
2. Who reads the queue, and at what hours. Once that is named, one line switches the rooms to **live**:
   `update public.plaza_flags set value = 'live' where key = 'mode';` (and back with `'review'`; `chat` to `'off'` closes all).
3. Chat for everyone or Plus: assumed everyone. 4. The Room chat words above.
5. Real hosts (people or labelled agents who reply): a later step, once someone stands behind them.

## 9. Codex design review (22 Oct, gpt-6.1-sol, read-only): BUILD WITH CHANGES, and what changed

| # | Finding | What was built |
|---|---|---|
| 1 (P0) | Live free text with nobody on duty | One switch, `plaza_flags.mode`: **review** (default: every message waits for a person in the staff queue) or **live** (most messages show at once; crisis words, treatment instructions and doses, and news in quiet rooms still wait). The staff Queue tab lists held messages with Show and Hide, audited |
| 2 (P0) | Post anyway; a phone flag as control | No Post anyway. Her own crisis words bring the care card and "Send it for a check" or "Keep it here"; the phone can only ask for a hold, never show; the server holds from the text itself |
| 3 | A scripted host looks like a person read it | No host replies. A labelled Room note at the top of each room; an automatic reminder under a shown crisis message, said to be automatic |
| 4 | Announcement list refuses grief | Holds, not refusals, present-tense phrases only; grief cases in the fixture show |
| 5 | The name word list blocks health talk | A message list of its own; health words allowed (tested) |
| 6 | Stale consent forms | `plaza_chat_on` needs the card handle and the last Room chat event the form saw; withdrawing Plaza friends or 18+ records a Room chat withdrawal |
| 7 | Notice promises | Words revised (who sees, 24 hours plus up to an hour, later joiners, held and reported messages, 90 days unresolved then a year) |
| 8 | Authorization contract | Reading: 18+, shown card, not paused, in the group on this visit. Writing: also Room chat and an entry. Blocks both ways, paused, hidden and withdrawn authors hidden. Under-18: no rooms at all |
| 9 | Locks | Her account (`social.lock`) then the plaza membership lock (`staff.plaza_sweep`), held through the checks and the write, for joining a room and saying; reports lock both accounts then the message row |
| 10 | Room entries | Each room join has its own entry id (a retried join keeps it); leave and say need it, so a late Leave cannot end a later entry |
| 11 | Account and request isolation | Every request carries its account; replies for another account, visit or room are dropped; another tab signing in clears rooms, feed and drafts |
| 12 | Profile-derived care markers | The diary matcher runs on the phone only; the public reminder comes from the server's text list |
| 13 | Reports and staff | A report needs a message she can see, counts each account once, three hide it; staff show or hide one message (Hide closes its reports, Show dismisses them); poll replies carry the visible ids, so retracted messages leave screens |
| 14 | Polling | One request in flight per poll, a 10 s deadline, and the group strip is the only thing asked away from the plaza |
| 15 | Labels | "In the plaza" and "Saved group" are named apart; room counts say "joined" and the list says anyone in the group can read; tab changes keep the room and the draft; a malformed answer hides the rooms |

Checks: dry run `tools/db/plaza_rooms_dryrun.sql` (70 checks, local 70/70); races `tools/db/race_test.py --rooms
--mutate` (6 of 6 safe with the second session seen waiting; with the locks removed 4 of 6 go wrong); core suite block
2k21r; smoke block "rooms:" (19 checks) and the staff room-messages checks.

## 10. Codex diff review, round 1 (22 Oct, gpt-6.1-sol, read-only): HOLD, and what changed (23 Oct)

Full text: `docs/design/reviews/2026-10-22-plaza-rooms-codex-diff-r1.md`.

| # | Finding | What changed |
|---|---|---|
| 1 (P0) | A queue reply survives an account switch on the staff page | Every staff request belongs to the account signed in when it left; a reply after another account signs in (this tab or another) is dropped. The page forgets everything it loaded and starts again. Smoke: a slow queue reply during a switch never draws |
| 2 | A care or hold sheet confirmed later could send into another room | The message is fixed when she taps Send: account, visit, room and her entry to that room. A sheet confirmed later sends only if all four still hold; otherwise "Something changed since this opened" |
| 3 | An older message shown after newer ones never reached readers | Every message has a revision (`plaza_messages.rev`), bumped on show, hide and the third report; the feed cursor is the newest revision she has. Dry run and smoke: an approval after a newer message arrives |
| 4 | A read refusal kept the messages and the box | Signed out, card gone or hidden, paused or under 18: the open room closes, its messages, box and entry go, late replies are dropped, and the list says why. Smoke: card hidden on another phone |
| 5 | Staff could list shown or hidden messages | `admin_plaza_messages` answers for held messages only |
| 6 | "Staff never see your group" | Plaza friends and the plaza sheet now say a held or reported room message shows staff its group and room |
| 7 | "Take 4 ibuprofen every 2 hours" showed at once in live mode | Held as advice: a dose, a schedule (every N hours, N times a day), or a named medicine next to take, stop, start, buy... The phone says why before she sends. Review mode stays the default |
| 8 | No under-18 guard in the rooms | A phone marked under 18 on its old age question asks for nothing and shows no groups, rooms or Room chat |
| 9 | A slow send cleared what she typed meanwhile | Only the words sent are cleared |
| 10 | Bare links such as example.co and myprofile.me | Two-letter and short endings count with a three-letter name (it.in stays allowed); the refusal says to add a space after a full stop if she did not mean a link |
| 11 | Lock checks could pass without the lock | The dry run checks acquisition on fresh accounts; three two-session lock-order races show the account lock held and the membership lock waited for (say, join, feed), and fail when the locks are removed |
| 12 | `{ok:true, rooms:[null]}` threw | Rows are checked before drawing; a bad row hides the rooms; busy flags always clear |
| 13 | `consent_record` could grant Room chat | A trigger refuses a Room chat grant from anywhere but `plaza_chat_on` (withdrawal still works anywhere) |
| 14 | Feed checks ran outside the locks | The feed takes her account lock and a shared membership lock; race: a withdrawal while she looks |

Checks after round 1: dry run 74/74 locally and on the live project, rolled back (all 29 function bodies equal the
file; nothing persisted); races 10 of 10 safe with the second session seen waiting, 8 of 10 go wrong with the locks
removed; core suite 1834/0; smoke rooms and staff blocks 32/32, and each new check fails on the code it guards against
(three against the previous commit, two by mutation).

## 11. Codex diff review, round 2 (23 Oct): HOLD, and the work stops here (AGENTS gate 6)

Full text: `docs/design/reviews/2026-10-23-plaza-rooms-codex-diff-r2.md`. Eight of the 14 round-1 findings are FIXED
(1, 2, 5, 9, 11, 12, 13, 14). Six come back NOT FIXED, so an independent review has now failed twice on the same
findings, and no further repair is made without the owner's decision:

- 3: a revision taken by an approval that commits after a later message's revision can still be skipped (commit order);
  the fix it names is to return the whole visible window with each row's current state on every look.
- 4 and 8: an open Report sheet survives a read refusal or the phone turning under 18, and its buttons still act.
- 6: the plaza sheet opened before the rooms probe still says staff see only counts.
- 7: other plain treatment commands ("Take insulin before meals", "Stop taking antibiotics") still show at once in live
  mode (review mode, the default, still holds every message).
- 10: more bare-link shapes pass (t.me/alice, t.co/hello, example.health).

New in round 2 (B): two P1 (a Room chat yes that arrives late sends a draft from another room; Off while already off
records nothing, so an older form can turn it back on), five P2 (a late feed reply restores messages deleted by Off or
Block; the staff queue does not refresh while open; a failed Show or Hide message is wiped; new messages pull a reader
who scrolled up to the bottom; the staff Plaza reports notice still says staff never see groups), and two P3.

Browser suite on this machine at load 30 to 48: 493 passed, 2 failed, both outside the rooms (the wider-world map
opening view, and Home while the room starts); the clean CI run decides those.
