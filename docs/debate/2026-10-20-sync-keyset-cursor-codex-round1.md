# Shared pull keyset cursor: Codex read-only review, round one (20 Oct 2026)

Reviewer: codex exec -s read-only (gpt-6.1-sol), on commit f38599b. Verbatim:

VERDICT: REJECT

1. **major, introduced: cursor rollback can restore deliberately cleared history.** [ovu-sync.js:312](/Users/michiyomimi/Doubao/chats/2026-10-16/new-chat-12/ovumind/.claude/worktrees/affectionate-dijkstra-e9307c/ovu-sync.js:312)  
   Tab A pulls through 11:00 and waits on an upload. Tab B finishes through 12:00. The person clears their local diary, then A finishes and overwrites the cursor with 11:00. Re-enabling backup restores cleared rows between 11:00 and 12:00. Clearing and re-enabling do not reset the cursor. I reproduced this against both versions: the base preserves 12:00 and leaves cleared row `r2` absent; the candidate regresses to 11:00 and restores `r2`.  
   **Fix:** guard cursor commits against changes since the starting cursor, including a reset generation, or serialize syncs across tabs. Add this regression test.

2. **major, pre-existing server hazard, outside this patch’s scope: commit order can differ from cursor order.** [20261019010000_accounts_sync_order_guard.sql:24](/Users/michiyomimi/Doubao/chats/2026-10-16/new-chat-12/ovumind/.claude/worktrees/affectionate-dijkstra-e9307c/supabase/migrations/20261019010000_accounts_sync_order_guard.sql:24)  
   Transaction A starts before B but commits after the client pulls B. A then lands behind the saved cursor and is missed. PostgreSQL confirms that [`now()` means transaction start](https://www.postgresql.org/docs/current/functions-datetime.html#FUNCTIONS-DATETIME-CURRENT). The exact cursor **does worsen one narrow case**: A at `.123100` arriving after B at `.123900` was accidentally recovered by the old `.123Z` cursor; the new cursor excludes it. I reproduced that difference.  
   **Fix separately:** use a committed change stream or coordinated writer/reader ordering. `clock_timestamp()` alone does not guarantee commit order.

3. **major, pre-existing lifecycle hazard, outside this patch’s scope: an upload completion can undo a reset.** [ovu-sync.js:309](/Users/michiyomimi/Doubao/chats/2026-10-16/new-chat-12/ovumind/.claude/worktrees/affectionate-dijkstra-e9307c/ovu-sync.js:309)  
   Sign-out, account switching or `resetPosition()` during an upload happens after the identity check at line 276. The old completion then assigns its captured user ID and restores progress into the current state. The base already has this defect.  
   **Fix separately:** capture an account/reset generation and revalidate it before subsequent uploads and state commits.

No other new defects found. Timestamp equality, escaping, legacy inclusive migration, discarded `pulledId` on resets, failed-upload replay, held rows and typed-recovery separation look sound. Production sorting and filtering use the same [database collation](https://www.postgresql.org/docs/current/collation.html); the mock’s JavaScript ordering is a limitation, not evidence of a production mismatch. Escaping matches the [PostgREST documentation](https://docs.postgrest.org/en/stable/references/api/url_grammar.html#reserved-characters).

Independently verified **490 passed, 0 failed**. Substituting the base sync source entirely in memory produces **485 passed, 5 failed**, including `20000,20000,20000`. No files edited. Static/browser results remain supplied evidence; the static rerun was blocked by unavailable temporary-file writes.


## Resolution

1. Fixed: the cursor only moves forward. If another tab moved it during this sync, ours is written only when strictly later to the microsecond; a tie keeps the stored one. Test: 'a slower tab never winds the cursor back' and 'a row cleared ... is not brought back' (both fail without the fix).
2. Not fixed here (server side, already there before): follow-up. The PR names the narrow case where the exact cursor drops the old code's accidental 1 ms overlap.
3. Fixed: the commit stops when the saved position no longer belongs to this account (sign-out, account switch or reset during the upload). Test: 'a reset during the upload stays a reset' (fails without the fix).
