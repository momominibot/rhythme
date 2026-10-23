You are reviewing a DIFF for Rhythme (women's health life-sim PWA, vanilla JS, Supabase). Read-only; do not edit files.
Repository: this working directory, branch claude/plaza-groups-1fc459. See the change with:
  git diff origin/main...HEAD
(new: ovu-rooms.js, supabase/migrations/20261022120000_plaza_rooms_chat.sql, tools/db/plaza_rooms_dryrun.sql,
tools/fixtures/plaza_text_cases.json, six door-sign images; changed: ovu-today.js, ovu-plaza.js, ovu-friends.js,
admin.js, room.css, room.html, sw.js, tools/test-core.js, tools/e2e_smoke.py, tools/db/race_test.py.)

Design and your own earlier design review: docs/design/2026-10-22-plaza-rooms-and-live-channel.md (section 9 records
how each of your 15 design findings was answered). Research: docs/design/2026-10-22-plaza-groups-research.md.

Owner rules that bind the change: no emoji (generated art or Material Symbols only); care copy world-wide (local
emergency number, nearest emergency department, findahelpline.com; never one country's numbers); no em dashes; no model
or provider names shown to users; 18+ only; under-13 never in social features; staff never read diaries; the migration
is written and dry-run but applied only by the owner; until it is applied the client must hide the rooms (the server
answers 404 PGRST202).

Judge, concretely:
1. Does the migration do what section 9 claims? Authorization of every call (rooms list, join, leave, feed, say, chat
   on/off, report, staff queue and decide); the lock order (account, then membership, then message row) and any path
   that takes them in another order or checks outside the locks; entry ids; holds (review mode, crisis, advice, news,
   asked, reports); visibility (blocks both ways, paused, hidden, withdrawn authors, held only to the writer, 24 h on read);
   retention (24 h, hourly job, 90-day open reports); the consent trigger (withdrawing social or age_18 also withdraws
   plaza_chat; the trigger inserting into its own table); grants and RLS on every new table and sequence; anything a
   signed-in person can read or change that she should not.
2. The client (ovu-rooms.js and its wiring): account binding of every request and reply, late replies after leaving
   or switching rooms, the in-place drawing (does any redraw replace the text box while she types; is any server text
   put into HTML unescaped), polling (one in flight, deadlines, stops when hidden), behaviour before the migration
   (one question, then nothing), malformed answers, the care card and hold sheets, mute, block, report.
3. Copy: accuracy of the Room chat words against what the server actually keeps and who sees it; anything that could
   mislead a person about who reads her words or how fast; the safety wording.
4. Tests: do the dry run, the races and the smoke checks prove the claims, or could they pass while the bug exists?

Answer format: first line exactly MERGE or HOLD. Then numbered findings, each with severity (P0 harm or data leak, P1
must fix before merge, P2 should fix, P3 note), file:line, the failure in one sentence, and the smallest fix. P2 means
ordinary use goes wrong; rare edge cases are P3. List every finding you have in this one pass.
