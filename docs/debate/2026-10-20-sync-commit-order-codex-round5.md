# Codex read-only review, round five: R5-B

21 Oct 2026. `codex exec -s read-only -m gpt-6-astra` on 516dd48 + f2901ad + 8545e88 (on main 5750a53), run once
under a guarded runner: a lock, one run (approval consumed), stdout and stderr checked for usage, rate, credit and auth
failures, a block written on the first provider failure, no retry and no other model. The runner's stop rules were
tested first against a fake `codex` (a usage-limit message with exit 0 blocks; an empty reply blocks; a second run is
refused). A first attempt at 10:30 had stopped at Codex's usage limit and was not retried; Codex runs in other sessions
that evening returned answers (read from their local logs, not a probe call), and Jamie asked for the review to finish
that day.

Verdict: NOT READY. Four should-fix defects and three nits, all fixed in the next commit, each with a regression test
that fails on 8545e88 (11 of the 55 checks in `sharedPullCommitOrder`). Independent reproduction before fixing: findings
1 and 2 reproduced with the real client in `tools/test-core.js` case 13; finding 3 with a pending registration lookup
(case 12e); finding 4 by reading `ovu-garden.js` and `ovu-greenhouse.js` (both hold the HUD while their minute runs and
save only at the end). The fixes have not had a second independent review.

## Prompt

You are reviewing a branch in the Rhythme PWA repository (current directory), read-only. Do not modify files.

Branch claude/sync-commit-order (PR momominibot/rhythme#16, draft), on origin/main: `git log --oneline origin/main..HEAD`.
Your earlier rounds: docs/debate/2026-10-20-sync-commit-order-codex-round1.md to round4.md. The design and review
record: docs/design/2026-10-20-sync-commit-order.md. This round reviews commit 516dd48 (`git show 516dd48`) and the
two docs commits after it (f2901ad, 8545e88); HEAD is 8545e88.

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

Four **should-fix** defects remain. Reviewed `8545e88` read-only, including the two documentation commits. No files changed; neither prohibited harness was run.

Round four’s findings:

| Finding | Status | Reason |
|---|---|---|
| 1. Delivered rows without a saved cursor | **PARTLY FIXED** | The time fallback is eliminated. The delayed checkpoint still permits replay, and failed first hand-overs can permanently omit rows, described below. |
| 2. Fallback from another tab’s stale mode | **FIXED** | There is no time-pull branch to select, regardless of captured or current state. |
| 3. Hidden reload loses unfinished work | **PARTLY FIXED** | Movement/Luna forms and the listed activities are protected. Sheetless plant-care activities are missed. |
| 4. Force refresh mistaken for first install | **PARTLY FIXED** | Works after registration lookup resolves; fails when takeover precedes that resolution. |

The earlier nits concerning the retired-page message, case 10’s initial-delivery assertion, and the stale fallback comment are **FIXED**. The group now genuinely has 41 checks. A separate historical comparison count remains wrong.

1. **should-fix · [ovu-sync.js:270](https://github.com/momominibot/rhythme/blob/8545e88/ovu-sync.js#L270), lines 414 and 447–453: failed first hand-over can permanently omit a row.**

   Reproduced with the actual client and existing test helpers:

   - The old time cursor is `10:00`.
   - Transaction 99 committed `d@11:00`.
   - Transaction 100 remains open with `pending@09:00`.
   - Transaction 101 committed `later@12:00`.
   - The first hand-over delivers `d`; an unrelated local upload fails with HTTP 500.
   - Neither the transaction cursor nor the first hand-over snapshot is saved.
   - Transaction 100 commits before retry.
   - Retry starts a **new snapshot**, classifies `pending` as completed behind the old time cursor, and excludes it.
   - Retry succeeds at cursor `102`; the following sync pulls zero. `pending` never arrives.

   This needs neither a clear nor an RPC rollback.

   **Fix:** persist the first hand-over snapshot independently of upload success and reuse it even while `pulledXid` is null. Currently line 270 ignores `pullSince` in that situation. Retain that snapshot across pagination failures too.

   The design note’s [“from the hand-over on nothing is lost” claim](https://github.com/momominibot/rhythme/blob/8545e88/docs/design/2026-10-20-sync-commit-order.md#L203) is therefore overstated.

2. **should-fix · [ovu-sync.js:115](https://github.com/momominibot/rhythme/blob/8545e88/ovu-sync.js#L115): retry already re-uploads unchanged cloud rows.**

   The delayed-checkpoint rationale is false: equal local/remote timestamps still enter `pushUp` when newer than `pushedAt`.

   Actual-client reproduction:

   ```text
   First sync: cloud row applied; local-note upload fails.
   Retry: same cloud row pulled again.
   First POST: [local]
   Retry POST: [cloud, local]
   Retry result: pulled:1, pushed:2
   ```

   Thus delaying the cursor retains the clear/reappearance cost without preventing the claimed upload amplification.

   **Fix:** distinguish exact cloud-acknowledged revisions from unsent local edits. A per-ID acknowledged-revision ledger permits checkpointing a successfully persisted pull independently of uploads, without advancing `pushedAt` over unsent edits. Merely skipping equal remote matches fixes this reproduction but does not suffice once an early checkpoint excludes those rows from subsequent pulls.

   Correct the rationale at [design lines 254–257](https://github.com/momominibot/rhythme/blob/8545e88/docs/design/2026-10-20-sync-commit-order.md#L254) and `ovu-sync.js:447–449`.

   **I would not accept the current design as only a documented clear/replay tradeoff**, given finding 1 and this disproved benefit.

3. **should-fix · [ovu-sync.js:330](https://github.com/momominibot/rhythme/blob/8545e88/ovu-sync.js#L330): a late registration result loses the takeover.**

   Sequence: module loads with `controller:null`; `getRegistration()` remains pending; `controllerchange` fires; registration then resolves with an active worker.

   Line 333 discards the event as first installation. Resolution only sets `had`, without reconsidering it. My actual-module probe remained:

   ```text
   canSync:true, notifications:0, reloads:0
   ```

   **Fix:** retain pending takeover evidence and reconcile it when registration discovery completes, or compare explicit build identities. An asynchronous registration lookup is not an immutable snapshot “at load.” The specification documents both asynchronous registration lookup and null controllers after force refresh. [Service Workers specification](https://www.w3.org/TR/service-workers/#navigator-service-worker-getregistration).

   The design’s [early-takeover guarantee](https://github.com/momominibot/rhythme/blob/8545e88/docs/design/2026-10-20-sync-commit-order.md#L157) needs qualification until fixed.

4. **should-fix · [room.js:2929](https://github.com/momominibot/rhythme/blob/8545e88/room.js#L2929): reload safety misses sheetless activities.**

   Garden watering and greenhouse care hide the sheet and maintain separate `watering`/`caring` state. They do not set the room flags checked here. Their journal entry is saved only on completion: `ovu-garden.js:139–166`, `ovu-greenhouse.js:157–178`.

   Starting actual greenhouse care, then applying the exact room predicate and takeover handler, produced:

   ```text
   caring:"monstera", canReload:true, reloads:1
   ```

   Switching apps during that minute can therefore reload away the unfinished activity.

   **Fix:** include all active activity owners in a shared reload-safety contract. Greenhouse already exposes `caring()`; expose/check garden watering too. Background podcast playback is also outside this predicate and can be interrupted.

   The design’s [“nothing is unsaved” description](https://github.com/momominibot/rhythme/blob/8545e88/docs/design/2026-10-20-sync-commit-order.md#L164) currently overstates coverage.

5. **nit · [migration header:31](https://github.com/momominibot/rhythme/blob/8545e88/supabase/migrations/20261020120000_sync_pull_commit_order.sql#L31): `time_safe` still claims an unconditional safe prefix.**

   Lines 37–38 say its only gap is still-open, invisible writes. SQL lines 160–165 preserve an inherited later time cursor, so an already-visible, undelivered row can also remain behind it. The design correctly admits this at lines 230–233.

   **Fix:** describe it consistently as a forward-only compatibility cursor with the documented skip/replay limitations. Qualify the similar wording at `ovu-sync.js:231–235`.

6. **nit · [design note:286](https://github.com/momominibot/rhythme/blob/8545e88/docs/design/2026-10-20-sync-commit-order.md#L286): main’s failure count is wrong.**

   Current `origin/main` is the cited `5750a53`. Independent reproduction gives **32 failures**, not 34. Correct the recorded count.

7. **nit · [ovu-sync.js:353](https://github.com/momominibot/rhythme/blob/8545e88/ovu-sync.js#L353), `room.js:2928`: “opens next time you come back” overpromises.**

   A retained sheet or unprocessed import scan intentionally prevents reload across repeated returns.

   **Fix:** say the update waits until unfinished work is finished or closed. The indefinite safety hold itself is documented and reasonable.

The remaining path checks were sound:

- No time-ordered retrieval remains. Typed recovery uses `id.asc`; `mergeRows` sorting does not constitute a time pull.
- PGRST202 reaches both the returned error and `status().error`.
- With an **already-persisted hand-over**, my probe preserved the entire state byte-for-byte, including `pullSince` and `typedAfter`. It made only the RPC request, with no typed recovery, diary application or upload.
- Every subsequent sync probes the RPC again.
- First account activation still writes account/generation bookkeeping before the request. “Nothing moved” should refer to diary contents and cursors.
- A throwing `canReload` correctly prevents reload. No service-worker support leaves the watcher inactive.
- Repeated takeover events produce one retirement/notification.

The permitted full suite passed **1,037 checks, zero failures**. I also independently ran HEAD’s isolated group with only `ovu-sync.js` substituted in memory:

| Checks, pass/fail | HEAD | Round four `4e4a218` | Main `5750a53` |
|---|---:|---:|---:|
| Entire group | 41 / 0 | 34 / 7 | 9 / 32 |
| Case 2c | 2 / 0 | 0 / 2 | 0 / 2 |
| Case 4 | 1 / 0 | 0 / 1 | 0 / 1 |
| Case 10 | 4 / 0 | 4 / 0 | 0 / 4 |
| Case 12 | 6 / 0 | 2 / 4 | 0 / 6 |

Case 10 correctly proves initial delivery and successful-sync replay prevention, but **does not detect round four’s failed-upload problem**. Cases 2c/4 cover missing-RPC behavior but not all persisted-hand-over/status fields. Case 12 waits for registration resolution before takeover and supplies a boolean safety stub, so it misses findings 3 and 4.

Rare follow-ups: loading the module twice with service-worker support installs duplicate watchers; repeated hidden events can request multiple reloads because there is no reload-request latch. The production HTML includes the module once, and successful navigation normally removes the old page.

Safari/iOS acceptance remains unverified. WebKit documents suspension of inactive iOS tabs, so requesting reload while hidden does not establish that navigation completes before the next foreground visit. Retain device checks for takeover, backgrounding, return and offline reload; the Node mocks establish callback logic only. [WebKit lifecycle behavior](https://webkit.org/blog/8970/how-web-content-can-affect-power-usage/).

VERDICT: NOT READY