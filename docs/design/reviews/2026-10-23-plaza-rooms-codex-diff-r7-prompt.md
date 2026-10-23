You are reviewing a DIFF for Rhythme (women's health life-sim PWA, vanilla JS, Supabase), round 7, a short verification pass.
Read-only; do not edit files. Repository: this working directory, branch claude/plaza-groups-1fc459.
  What changed since round 6:  git show HEAD   (the round-6 fixes)
Your round 6 (docs/design/reviews/2026-10-23-plaza-rooms-codex-diff-r6.md) said MERGE with A10, new 4 and new 6 not fixed
and two new P2s from the round-5 rule changes; design note docs/design/2026-10-22-plaza-rooms-and-live-channel.md section
17 says how each was answered.

The rooms are review only (a check holds plaza_flags.mode at 'review'): every message waits for a person. The refusal
rules (links, contact details, words) are a first filter before that person, so a phrase they miss is not published.

Do two things:
1. For each round-6 item (A10, new 4, new 6, new 1, new 2), say FIXED or NOT FIXED with file:line.
2. Sweep only this diff (`git show HEAD`) for defects it introduces, ranked by severity. For the refusal rules, report a
   phrase only if ordinary conversation is now refused wrongly, or if the phone and the server now disagree. Do not list
   further contact or link phrasings that the first filter misses: the review-only boundary handles those.

Answer format: first line exactly MERGE or HOLD. Then section A and section B, each finding with severity (P0 harm or data
leak, P1 must fix before merge, P2 ordinary use goes wrong, P3 rare edge case or note), file:line, the failure in one
sentence, and the smallest fix. MERGE means no P0 or P1 remains.
