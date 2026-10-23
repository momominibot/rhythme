You are reviewing a DESIGN, before any code is written, for Rhythme: a women's health life-sim PWA (vanilla JS, Supabase).
Read-only. Repository: this working directory.

Read first:
- docs/design/2026-10-22-plaza-rooms-and-live-channel.md  (the design under review)
- docs/design/2026-10-22-plaza-groups-research.md          (the evidence it rests on)
- docs/design/2026-10-19-plaza-chat-friends.md and docs/design/2026-10-21-today-tabs-and-channel-chat.md (earlier decisions)
- ovu-plaza.js, ovu-friends.js, ovu-today.js, ovu-orb.js (urgent(), the warning-sign matcher)
- supabase/migrations/20261019110000_plaza_visits.sql and 20261019130000_plaza_friends.sql (the live server rules)

Owner rules that bind the design: no emoji (art or Material Symbols only); care copy is world-wide (local emergency
number, nearest emergency department, findahelpline.com; never one country's numbers); no em dashes; no model or
provider names shown to users; 18+ only; under-13 never in social features; staff never read diaries; migrations are
written and dry-run but applied only by the owner; the client must degrade (feature hidden) until then.

What to judge, concretely:
1. Safety of opening free-text chat in health groups (TTC, loss, PCOS, postpartum mental health, menopause) with these
   rules and NO human moderator on duty yet. What is missing that would let someone be harmed before staff notice?
   Is "post anyway after the care card" right, or should a self-harm match not post? Is the scripted, labelled host
   line acceptable, or misleading?
2. The loss-space rule: is a server phrase list for pregnancy/birth announcements in After a loss and TTC rooms
   workable, and does it risk refusing grief? Is "no Wins room in After a loss" the right resolution?
3. Consent: is a separate purpose plaza_chat needed beyond Plaza friends (social)? Are the Room chat words accurate?
4. Data and concurrency: room presence tied to the group visit; capacity under the plaza membership lock; saying under
   the account lock; report auto-hide at three distinct reporters; 24 h retention; cascade from the card. Races or
   leaks you can see (another tab's account, displaced phone, blocked authors, hidden card, paused account).
5. Polling (4 s open room, 10 s rooms list, 20 s groups) versus a realtime channel, for this app's size.
6. Anything in the Channel tab plan that will confuse a person (counted only in the plaza, chat away from the plaza).

Answer format: a verdict line BUILD / BUILD WITH CHANGES / REDESIGN, then numbered findings, each with severity
(P0 harm or data leak, P1 must fix before build, P2 should fix, P3 note), the exact design text or file it concerns,
and the smallest change that fixes it. Be specific; no general advice. Do not edit files.
