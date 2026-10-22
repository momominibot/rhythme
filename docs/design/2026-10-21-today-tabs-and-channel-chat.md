# The Today card's three tabs, and what a group chat would need (21 Oct 2026)

Jamie: "today check in should have 3 tabs today's, server chat once they have joined the channel, inventory."

## Built today (branch `claude/today-tabs`, module `ovu-today.js`)

**Today** is the check-in as it was: six tiles, the calm count, quick answers, Choose what counts, the morning invitation, the day's bullet points. Nothing moved inside it.

**Channel** is her plaza group's page, and it follows the group she joined:

| Her situation | What the tab shows | Buttons |
|---|---|---|
| Signed out | Sign in from You, then join a group in the plaza. Each group has its own channel. | Sign in from You |
| Signed in, no group | Join a group in the plaza to open its channel (the four groups named). | Walk to the plaza, or Choose a group when she already stands there |
| Joined, away from the plaza | The group's name and icon; "You are in this group. You are counted, and see who else is here, while you stand in the plaza." Today's noticeboard prompt. The Plaza friends line (card, friends, new notes). | Open the board, Plaza friends, Walk to the plaza |
| Joined and counted there | The same, with the live count ("Just you here for now", "4 people here, with you", or "Reconnecting to the group"). | Open the board, Plaza friends |

The group is the one `ovu-plaza.js` already remembers on the device for her account (`state.plaza = {server, uid}`), so leaving the plaza does not lose the channel; tapping Leave in the group sheet does. The tab carries a badge with the Plaza friends count of new asks and unread notes. The honest line stays on the page: typed chat is not open yet; friends send kind notes from a set list; staff see counts, cards and reports, never a diary.

**Inventory** lists what she owns, from this device's state only, with a button into the place that handles each thing:

- hearts and the total earned, with Shop;
- Dream Street things: furniture (in the room or put away) and homes (where she lives, or hers to visit);
- pets by name with what each wears, accessories (worn by whom, or in the drawer), treats left;
- the wardrobe: how many outfits and the one she wears;
- the farm basket (crops and herbs in plurals), the pantry (eggs, milk, onsen eggs), seeds, the shed's tools;
- the greenhouse: cuttings to plant and what is growing in how many planters;
- kitchen staples; the harbour book (fish met, casts so far); floats and letters waiting at the post box.

Nothing in the inventory costs or earns hearts, and nothing is sent anywhere. Empty sections carry one plain invitation each.

## Why there is no typed chat yet

Rhythme's groups are about health (PCOS, trying to conceive, menopause). Free text between strangers in a health group is the one feature that can hurt someone in the time it takes staff to notice. Everything we have on the server side today is deliberately narrow: presence counts, plaza cards, set-phrase hellos and notes, friend asks, reports to staff, and a staff dashboard that only shows per-account opt-in data with k-anonymity. None of that can carry a sentence somebody typed.

## What a channel chat needs before it opens (proposal, for Jamie's decisions)

1. **Who may talk.** Signed in, a plaza card, a joined group, and an explicit adult attestation at first use (the app already splits under-13s at onboarding; the chat gate should be 18 and over, since the groups discuss fertility and menopause care). One account, one handle, the plaza name she already chose.
2. **What travels.** One `channel_messages` table per message: group id, author handle, text up to 280 characters, created_at, a soft-delete flag and a reason. No images, no links (URLs rejected server side), no diary fields, no location. Thirty-day retention, then deleted; her own export and delete requests honoured like every other record.
3. **Three stages, each one switchable off from the server (fail closed, like the AI pause flag: a missing flag means paused):**
   - Stage 1, now: set-phrase notes between friends (built).
   - Stage 2: replies to the day's noticeboard prompt from a set list of answers plus one free line, pre-moderated: a message shows to the group only after a staff tap in the dashboard. Everyone group first, the health groups later.
   - Stage 3: live chat with post-moderation, only once stage 2 has run for a month with the report rate and staff hours known.
4. **Automatic guards before anything shows:** rate limits (six messages a minute, sixty a day, per account, counted in Redis with fixed windows, as GoutBye's relay does); the app's own warning-sign matcher runs on each message and, on a self-harm or emergency match, shows the writer the care card instead of posting; medicine names with doses, "stop your", "instead of your doctor" and similar phrases are held for staff; the same line sent twice in a row is dropped.
5. **People's own controls:** mute a person, block a person (neither sees the other again), report with a reason from the existing list; a report sends the message, both cards and the previous five lines to staff, nothing else.
6. **Staff:** who moderates (Erin's team, Rhythme staff, or both), covering which hours, with a published response time; a dashboard queue with approve, hide, warn, pause-account actions and an audit row for each; a kill switch per group.
7. **Law and notice (Singapore first):** PDPA notice at the moment she joins the chat, naming what is stored and for how long; the Online Safety Code's expectations for user reporting and removal of harmful content; a clear "not medical advice, not monitored around the clock" line at the top of every channel. A review of the words by a clinician before the health groups open.
8. **Cost and measures to watch:** messages a day, reports per thousand messages, median time to staff action, how many people mute or leave after a session. Stage 3 only if reports stay rare and staff time stays within what Rhythme can pay for.

Decisions this needs from Jamie: the age gate, who moderates and when, whether chat is a Rhythme Plus perk or open to all, and whether the health groups ever get live chat or stay on moderated prompt replies.
