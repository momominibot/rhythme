# Sync commit order: Codex round five (not run)

21 Oct 2026. Reviews commit 516dd48 (R5-B). **Not run:** `codex exec -s read-only -m gpt-6.1-sol` stopped before
reviewing with "You've hit your usage limit ... try again at Oct 27th, 2026 2:41 PM." Under the token-waste rule (no
automatic retry, no model or account fallback after a provider failure) it was not retried and no other reviewer was
put in its place. The prompt below is ready to run as is once Codex is available again, or with another reviewer if
Jamie chooses one.

## Prompt

You are reviewing a branch in the Rhythme PWA repository (current directory), read-only. Do not modify files.

Branch claude/sync-commit-order (PR momominibot/rhythme#16, draft), on origin/main: `git log --oneline origin/main..HEAD`.
Your earlier rounds: docs/debate/2026-10-20-sync-commit-order-codex-round1.md to round4.md. The design and review
record: docs/design/2026-10-20-sync-commit-order.md. This round reviews commit 516dd48 (`git show 516dd48`).

Round four found (1) delivered rows with no saved cursor after a failed upload, then a time fallback; (2) a tab falling
back from a stale view of another tab's mode; (3) a hidden-page reload dropping an unsaved form; (4) a force-refreshed
page's first takeover taken for a first install. Jamie chose R5-B:
(a) ovu-sync.js has no time-ordered pull at all: pullSince, afterCursor, quoted and the commitPull page cache are gone.
pullShared always calls entries_pull; on PostgREST 404 PGRST202 it throws PULL_PAUSED and the sync stops with nothing
moved, for a new phone and an old one alike. Ship order: the migration first, then the app. time_safe is still written
to pulledSeq/pulledId for a tab on an older version, and the time cursor starts a hand-over.
(b) The update watcher (armUpdates) is armed when ovu-sync.js loads. "Update" = the page had a controller at load, or
had none but getRegistration() resolved with an active worker (force refresh). On an update: retire() at once, the
room's note via watchUpdates(onUpdate, canReload), and a reload only when document.hidden AND canReload() is true,
checked again at each visibilitychange to hidden. room.js's canReload: no sheet open (current), no Luna card (careOn), no
meditation, session, practice, Morning start, health import in progress or scanned file waiting (importing, imp.scan),
not arranging. syncNow on a retired page returns reason 'update' with words, and ovu-auth.js shows them.
(c) A deliberate choice to raise with you: the cursor is still saved only after the uploads. Saving it right after the
pulled rows are applied would mean a failed upload leaves those rows on the phone as local rows newer than pushedAt and
not in the next pull, so the next sync pushes them back up (on a first restore, up to 20,000 rows, re-pulled by every
other phone); moving pushedAt to cover them could skip unsent local edits. The cost of keeping it: rows delivered in a
failed sync can come back after "Delete every entry on this device" if that happens before the next good sync. With
no time fallback, is this acceptable as documented, or do you see a better fix (for example a per-id ledger of rows
applied from the cloud)?

Please:
A. Say FIXED / PARTLY FIXED / NOT FIXED for round four's findings 1 to 4 and its nits, with reasons.
B. Review for real defects: any remaining path to a time-ordered pull; the pause path (status, message, cursor and
   pullSince untouched, the typed recovery, a hand-over in progress when entries_pull disappears); armUpdates timing
   (getRegistration resolving after a controllerchange, multiple events, a page with no service worker support, the
   module loaded twice in tests); canReload coverage in room.js (anything unsaved it misses, anything that could leave a
   page waiting forever); the reload when canReload throws; Safari/iOS PWA behaviour you know of.
C. Tests: do sharedPullCommitOrder cases 2c, 4, 10 and 12 test what they claim, fail on round four's ovu-sync.js
   (4e4a218) and on main's (origin/main), and pass here? You may run `node tools/test-core.js` (under a minute). Do not
   run tools/db/pull_order_test.py or tools/e2e_smoke.py.
D. Anything in the design note or the migration's header comment that is now wrong or overstated.

Treat as should-fix only what can happen in ordinary use; list rare cases as follow-ups. List every defect you find in
one pass, ranked by severity: severity (blocker / should-fix / nit), file:line, a concrete failing scenario, and the fix.
End with one line: VERDICT: READY or VERDICT: NOT READY (blockers or should-fix items remain).

## Reply

None: the run ended at the usage-limit error.
