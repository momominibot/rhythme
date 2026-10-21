# Codex read-only review, round four: option A2

20 Oct 2026. `codex exec -s read-only` on 1f9ac4c + 9182aca (rebased on main 3c99e14). Verdict: NOT READY. Round three's finding 2 is FIXED for its reproduction; finding 1 is PARTLY FIXED, with two should-fix ways this version can still reach a time-ordered pull after moving over. That is the fourth failure on the same compatibility path, so the branch is **held at AGENTS gate 6** for Jamie. Two further should-fix defects are in the new takeover handling. No repair applied.

## Independent reproduction (Claude, scratch copy of tools/test-core.js, not committed)

- Finding 1 (rows visible before the cursor is saved): the first transaction pull delivers d (early held behind the fence), then an unrelated upload fails (500). The phone has d but pulledXid is still null, because the cursor is written only after the uploads. After a clear, with entries_pull missing, the next sync pulls by time and restores early and d. Confirmed.
- Finding 2 (a stale view of another tab's mode): confirmed by reading the code. pullShared decides the fallback from the state captured when the sync started, so a tab that began before another tab moved over still pulls by time; alive() does not catch it because the generation did not change.
- Findings 3 and 4 (reload when hidden can drop an unsaved draft; a null controller after a force refresh is not a first install): accepted as described. Neither was run on a real iOS device.

## Options for Jamie (none applied)

- **R5-B (recommended): no time-ordered pull in this version at all.** Remove the fallback. A phone that finds entries_pull missing pauses with the message, whether or not it has moved over; a phone with an older time cursor hands over as soon as entries_pull answers. This removes findings 1 and 2 as a class instead of patching another race, after four rounds on that path. Cost: the ship order flips. Apply the migration first (older app versions keep working against it unchanged, as the note shows), then merge the app. If the migration is ever rolled back, this version's sync pauses until it is back, and nothing is lost or sent twice. time_safe stays only for tabs still running an older version, with the weaker guarantee written down.
- **R5-A: keep the fallback, close the two races.** Persist a sticky transaction mode (and the cursor and hand-over state) as soon as the first entries_pull reply is applied, before any upload, keeping the push watermark separate; on PGRST202 re-read the shared state, and re-read it again just before applying a time-ordered reply, pausing if any tab has moved over. Keeps today's ship order, but leaves a residual window between tabs where Web Locks are missing, and more surface for a fifth round.
- **Either way, the takeover handling:** retire syncing at once, but reload only when the page is hidden and nothing is unsaved (room.js passes a check that no sheet or form is open; otherwise the note offers a Reload button), never on hiding alone; decide 'update' from the registration state at load (an active registration with a null controller is a force refresh, not a first install) and attach the watcher before the image boot; say plainly on a retired page why Sync now does nothing; fix the stale comment at ovu-sync.js near the fallback, tighten case 10's assertions, and correct the check count (35).

## Prompt

```
You are reviewing a branch in the Rhythme PWA repository (current directory), read-only. Do not modify files.

Branch claude/sync-commit-order-a2 (it becomes PR momominibot/ovumind.github.io#16), on origin/main:
`git log --oneline origin/main..HEAD`. Your earlier rounds: docs/debate/2026-10-20-sync-commit-order-codex-round1.md,
round2.md and round3.md. The design and review record: docs/design/2026-10-20-sync-commit-order.md.

Round three found that a single (synced_at, id) time cursor cannot be both skip-free and replay-free once the
transaction-ordered pull has delivered rows out of time order (d at 10:00 delivered while early at 09:00 is held behind
the fence), with two counterexamples: (1) replay of d after a clear and a fallback; (2) a cursor kept from an earlier
sync skipping early. Jamie chose option A2. Commit 1f9ac4c implements it; 9182aca updates the note and guards a test.

A2: (a) in ovu-sync.js pullShared, a phone that holds a transaction cursor (pulledXid) never pulls by time: on PostgREST
404 PGRST202 it throws PULL_PAUSED and the sync stops with that message; a phone with no transaction cursor still falls
back to the time-ordered pull; the commitPull page cache only short-cuts to the time pull when no pulledXid exists.
(b) time_safe is still written to pulledSeq/pulledId, but only for a tab still running an older version, which can only
pull by time; its weaker guarantee is documented (premortem 5) and tested (sharedPullCommitOrder cases 10 and 11, the
olderTabPull helper). (c) watchUpdates()/retire() in ovu-sync.js, called from room.js next to the service worker
registration: on controllerchange, the first install claiming the page is ignored; any later takeover retires the page
(canSync false, syncNow returns reason 'update', a sync in flight cancels at its next alive() check) and reloads it when
document.hidden (now, or at the next visibilitychange to hidden); a toast says the new version opens next time.

Please:
A. Say FIXED / PARTLY FIXED / NOT FIXED for round three's findings 1 and 2, for this version of the app, with reasons.
B. Review A2 for real defects: the PGRST202 stop only when pulledXid is set (and isXid), the commitPull cache across
   syncs and tabs, the hand-over (pullSince) when entries_pull goes missing mid-hand-over, the message and the
   status/error path, any way this version can still reach the time-ordered pull after moving over (account switch,
   reset, a cleared pulledXid, another tab writing pulledXid null, legacy state), retire()/watchUpdates() (first install
   vs update, a page that loaded with no controller, multiple controllerchange events, a reload while a sync or a save is
   in flight, Safari/iOS PWA behaviour of controllerchange and visibilitychange, the toast), and whether the older-tab
   guarantee is stated accurately.
C. Tests: do cases 10, 11 and 12 test what they claim, and fail on the round-three code (525062b's ovu-sync.js) and
   pass here? You may run `node tools/test-core.js` (about a minute). Do not run tools/db/pull_order_test.py.
D. Anything in the design note that is now wrong or overstated.

For each defect: severity (blocker / should-fix / nit), file:line, a concrete failing scenario, and the fix.
End with one line: VERDICT: READY or VERDICT: NOT READY (blockers or should-fix items remain).
```

## Reply

Four **should-fix** defects remain. Reviewed read-only; no files changed. I did not run the database harness.

| Round-three finding | Status | Reason |
|---|---|---|
| 1. Replay after clear and fallback | **PARTLY FIXED** | The supplied successful-sync reproduction is blocked. Failed uploads and concurrent tabs can still bypass the transaction-mode boundary, as below. |
| 2. Inherited time cursor skips `early` | **FIXED for the original reproduction** | With its valid transaction cursor persisted, this version pauses on PGRST202 and delivers `early` when the RPC returns. |

1. **should-fix · [ovu-sync.js:423](ovu-sync.js): transaction rows become visible before their cursor is saved.**

   The cursor is saved later, at line 463, after fallible uploads.

   Reproduced with the actual client and existing test helpers:

   ```text
   First transaction pull delivers d; early remains behind fence 100.
   An unrelated local-note upload fails.
   Local diary contains d, but persisted pulledXid is null.

   Clear phone; restore backup consent; entries_pull becomes unavailable.
   Next sync succeeds by time and restores early,d.
   ```

   **Fix:** checkpoint the successfully applied pull independently of upload success, including its hand-over state. Persist transaction-mode admission before exposing transaction-delivered rows, so an incomplete upload cannot re-enable time fallback. Keep push watermarks separate.

2. **should-fix · [ovu-sync.js:296](ovu-sync.js): fallback uses a stale snapshot of another tab’s mode.**

   Reproduced with two actual client contexts sharing storage and without `navigator.locks`, a path this module explicitly supports:

   ```text
   A starts with pulledXid:null; its missing-RPC response is delayed.
   B successfully pulls d and persists pulledXid:"100".
   B clears the phone.
   A receives PGRST202 and falls back using its captured null cursor.
   A restores early,d, while stored pulledXid remains "100".
   ```

   The generation does not change, so `alive()` permits this.

   **Fix:** check current shared mode before selecting fallback and again before applying a time-pull reply. Serialize mode transitions and time delivery across tabs where Web Locks are unavailable; preserving the newer cursor during the final save does not prevent incompatible rows from being applied.

3. **should-fix · [ovu-sync.js:357](ovu-sync.js): hidden-page reload discards unfinished work.**

   Fill the Movement activity, minutes and note, receive an update takeover, then switch apps or lock the phone. The visibility handler reloads immediately. Those fields are only saved by the Save handler at [room.js:2214](room.js), so the draft disappears. Pending Luna confirmation work has the same exposure.

   **Fix:** retire syncing immediately, but persist and restore drafts or wait for a safe application checkpoint before reloading. Hidden does not establish that work has been saved. Browser lifecycle guidance likewise recommends persisting unsaved state on hiding. [Chrome lifecycle guidance](https://developer.chrome.com/docs/web-platform/page-lifecycle-api#developer-recommendations-for-each-state).

   Completed local saves are synchronous and are not interrupted halfway by `controllerchange`. Network work and unsaved drafts need separate handling.

4. **should-fix · [ovu-sync.js:351](ovu-sync.js): an initially null controller does not prove first installation.**

   A force-refreshed page can have `controller === null` despite an existing registration. If a newer worker subsequently claims that older page, its first `controllerchange` is ignored. The actual-code probe leaves `canSync:true`, with no toast or reload handler. The null-controller precondition is explicitly documented by the [Service Workers specification](https://www.w3.org/TR/service-workers/#navigator-service-worker-controller).

   **Fix:** identify the page and worker builds, rather than classifying installation by event count. Install detection earlier and reconcile the controlling build when attaching: the current watcher waits until room-image boot, so an earlier takeover can also be missed.

The remaining path checks found:

- With a **valid persisted XID**, the cache cannot short-circuit to time mode. PGRST202 pauses, and subsequent attempts probe the RPC again.
- A persisted mid-hand-over cursor and `pullSince` survive RPC disappearance intact. If the initial hand-over loses the RPC during pagination before any cursor exists, buffered transaction rows have not yet been applied; that fallback does not itself mix delivered orders.
- Ordinary current-version and origin/main read-modify-write paths preserve unknown XID fields. Reset, sign-out, account activation and backup-off deliberately clear the cursor. Thus “never again” needs an account/generation qualification.
- Invalid non-null `pulledXid` is treated as absent by `isXid` and can reach time mode. I found no ordinary inspected writer producing that malformed value.
- PULL_PAUSED reaches `status().error` and the manual-sync error toast. **Nit, `ovu-auth.js:403`:** a retired page instead returns `reason:'update'`, which renders as “Sync failed: try again”. Handle that reason explicitly.
- Repeated takeover events are guarded against repeated retirement/toasts. Actual Safari/iOS PWA lifecycle behavior was **not verified** by these Node tests.

The test results are:

| Verification | Current client | Only client replaced with `525062b` |
|---|---:|---:|
| Full core harness | **945 passed, 0 failed** | Not run |
| Isolated `sharedPullCommitOrder` | **35 passed, 0 failed** | **28 passed, 7 failed** |
| Cases 10–12 assertions | **8 passed, 0 failed** | **3 passed, 5 failed** |

Cases 10 and 11 exercise the original counterexamples. `olderTabPull` accurately reproduces the older filter for these small datasets, but does not execute the older application’s storage writes, pagination or lifecycle.

**Nit · [tools/test-core.js:1755](tools/test-core.js):** case 10 permits `!t10.seen.d`. It can pass without proving that `d` initially arrived. Assert initial `ids === 'd'` and `seen.d === 1` before clearing, then require that count to remain one.

Case 12 verifies mocked event sequencing, retirement and later hidden reload. It does not verify first-install classification, in-flight cancellation, draft preservation, already-hidden takeover, actual worker installation or Safari/iOS behavior. Its fake controller remains null throughout.

The [design note](docs/design/2026-10-20-sync-commit-order.md) needs these corrections:

- **Lines 138–140:** the unconditional no-time-pull claim is contradicted by findings 1 and 2.
- **Lines 153–154:** “nothing being typed is lost” is false.
- **Line 155:** “every hand-over” is too broad. Application-only changes do not trigger takeover when worker resources remain identical. [Worker update algorithm](https://www.w3.org/TR/service-workers/#update-algorithm).
- **Lines 186–187:** “hand over at once” conflicts with the cached-negative policy: a page without an XID can remain in time mode until reload or another tab establishes one.
- **Lines 210–213:** distinguish older tabs and reset generations from this version’s continuing transaction mode. The earlier-snapshot maximum also prevents `time_safe` from being an unconditional current safe-prefix certificate.
- **Line 252, nit:** there are **35**, not 36, isolated checks. The stated seven failures against round-three code is correct.
- **`ovu-sync.js:264–265`, nit:** the comment still promises fallback after RPC loss; update it to A2’s pause policy and weaker older-tab guarantee.

The older-tab limitations in premortem 5 are otherwise accurately qualified: earlier certifications can leave skips, and a clear can expose replay above a held-back row.

VERDICT: NOT READY