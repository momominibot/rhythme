You are reviewing a DIFF for Rhythme (women's health life-sim PWA, vanilla JS, Supabase), round 4. Read-only; do not edit files.
Repository: this working directory, branch claude/plaza-groups-1fc459.
  The whole change:            git diff origin/main...HEAD
  What changed since round 3:  git show 980ded7   (the round-3 fixes; the merge of main before it, 99a9125, only brings in
                               other merged PRs and a service-worker version)
Earlier reviews: docs/design/reviews/2026-10-22-plaza-rooms-codex-diff-r1.md, ...-r2.md (23 Oct), ...-r3.md (23 Oct).
How round 3 was answered: design note docs/design/2026-10-22-plaza-rooms-and-live-channel.md section 14.

Owner rules that bind the change: no emoji (generated art or Material Symbols only); care copy world-wide (local
emergency number, nearest emergency department, findahelpline.com; never one country's numbers); no em dashes; no model
or provider names shown to users; 18+ only; under-13 never in social features; staff never read diaries; the migration
is written and dry-run but applied only by the owner; until it is applied the client must hide the rooms (the server
answers 404 PGRST202). The rooms start in review mode (every message waits for an owner) and live mode is one owner switch.

Do two things in this one pass:
1. For each round-3 item (A7, A10, B3 and new findings 1 to 9), say FIXED or NOT FIXED, with the file:line that shows it,
   and for NOT FIXED the concrete failure that still happens.
2. Then one exhaustive sweep of everything reachable from the rooms and the staff queue as they now stand. List every
   defect you find now, ranked by severity. Say for each whether the tests (dry run, races, smoke, core) would catch it.
   For the word rules: the instruction rule now reads sentence shape, not a medicine list. Judge the boundary as a whole
   for a peer-support room; report a phrase only if ordinary use would publish a treatment instruction, a link or a
   contact detail in live mode, and say whether a general fix exists rather than one more word.

Answer format: first line exactly MERGE or HOLD. Then section A (round-3 items, FIXED / NOT FIXED) and section B (new
findings), each with severity (P0 harm or data leak, P1 must fix before merge, P2 ordinary use goes wrong, P3 rare edge
case or note), file:line, the failure in one sentence, and the smallest fix. MERGE means no P0 or P1 remains.
