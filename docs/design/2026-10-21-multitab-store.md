# Two tabs, one diary: a stale tab no longer writes over the other

21 October 2026. Follow-up to PR 42's open item: "OvuStore writes its whole store from each tab's in-memory copy, so a
stale tab can overwrite another tab's changes, consent included."

## The bug, reproduced

`ovu-store.js` keeps the whole diary in one localStorage key (`ovumind_db_v1`) and a copy in memory per tab. `save()`
wrote that copy whole. A tab refreshes its copy only when the `storage` event arrives, and a tab asleep in the
background, or one whose event is still on its way, writes before it hears. Reproduced in `tools/test-core.js`
(`twoTabsShareOneStore`: two windows over one localStorage, as two tabs are; the shim has no storage event) and in
`tools/e2e_smoke.py` (two pages in one browser context, tab A ignoring storage events):

1. tab A loads the diary;
2. tab B saves a reflection, grants a consent purpose, writes `state.farm`, edits one entry and deletes another;
3. tab A saves a mindfulness entry.

Before the fix the stored diary had none of B's work: the reflection, the consent event (and `profile.cloud`), the
farm and the edit were gone, and the deleted entry was back. 14 of the new checks failed.

## The fix: merge at write time, three ways

Each tab now remembers the stored text it last read or wrote (`seenRaw`) and its own copy at that moment (`baseText`).
`save()` reads the stored text first. If it is still `seenRaw`, nothing changed elsewhere and the write is as before.
If not, the stored copy (theirs) is merged with memory (mine) against the base:

| Part | Rule |
| --- | --- |
| Entries, by id | Added in either tab: kept. Deleted in either tab: stays deleted (a delete is never undone). Changed in one tab: that change. Changed in both: the newer `updatedAt`; this tab's on a tie. |
| Consent events (`profile.consentEvents`), by id | The same rule. Order: the stored log, then this tab's new events. Both tabs share one clock and this tab's events are being saved now, so this is the order they were made in, and `stateFromEvents` (latest in log order) picks the choice made last. |
| Other profile keys, state keys | Key by key: changed in one tab, that value; changed in both, this tab's (the write being made now). A key moves whole, so `state.farm` or `state.rewards` never mixes two tabs' halves. |
| `summaries` | Whole, the same way. |

"Changed" means different from the base, so a deletion is told apart from an addition without tombstones in the
store: an id in the base and missing from either side was deleted there. This is what the sync code's tombstones do
across devices; across tabs the shared base does the same job without a new stored field or format change.

The merge is built apart from memory and adopted, in place, only after the write verified. So a failed save (storage
full) leaves memory exactly as it was, as `S.commit` promises, and callers holding an entry or the state object keep a
live one.

`catchUp()` runs the same merge into memory, without writing, at the start of the store's own read-then-write calls:
`add` (another tab may already have today's period or check), `update` (an entry deleted elsewhere throws "That entry
no longer exists." instead of being written back), `remove`, `removeWhere`, `addMany`, `applyRemote`,
`setCheckinAnswer` (it copies all answers whole) and a merging `importJSON`. The storage event now calls `catchUp()`
too, instead of a plain reload, so anything this tab has not saved yet survives it. Delete everything (`clearAll`)
and a replacing import write whole, on purpose: they must not keep what another tab had just saved.

Reads catch up too. Every save also writes a short token to `ovumind_db_rev`. `load()`, which every read goes through,
compares that token with the one this tab last saw (one small read, not the whole diary) and catches up when it
changed. So a caller that reads `S.state().farm`, builds a patch and commits it builds on the current copy, and sync
plans its upload from the current diary. Delete everything removes the token; other tabs read its absence as a change.

Adversarial review (a subagent, 21 Oct) found four more, all fixed with a check each:

1. Read, then commit: a stale tab's farm patch undid seeds whose hearts the other tab had already taken. Fixed by the
   read catch-up above.
2. A cloud put planned from a stale list replaced another tab's newer edit. Fixed by the read catch-up, and
   `applyRemote` never replaces a local copy with a newer `updatedAt`. A put for an entry another tab deleted is
   settled by sync's own tombstones, which live in the shared `ovumind_sync_v1`.
3. `setProfile` did not roll back on a failed save, so a consent choice that never saved stayed in memory and could
   land later, after a newer withdrawal in the other tab. It now rolls back like `commit`.
4. Backup tombstones came from "in the old shadow, not in memory", so a delete in a stale tab, made after another
   page's Delete everything, would have queued tombstones for the whole wiped diary and emptied the cloud backup. The
   store now passes the ids a `remove` or `removeWhere` deleted, and only those become tombstones.

Why not refresh on the storage event with a generation check: the event is exactly what a stale tab missed, and a
counter would only detect the conflict, not resolve it. The sync code's generation counter and web lock guard uploads
across tabs; a lock around every local save would make each tap asynchronous, which `add()` and `commit()` callers do
not expect.

## Limits

- **A value held across time.** A caller that read a value earlier (a sheet opened a minute ago) and commits it now
  writes that value whole; the key rule keeps it, so the other tab's change to that same key in between is lost.
  Example: an open shop sheet in tab A built from `state.rewards` before tab B earned hearts. The diary and the
  consent log are safe (by id); only same-key game state and settings can lose the other tab's edit. Counters would
  need operations, not values.
- **Edit against delete.** An entry edited in one tab and deleted in the other stays deleted. That honours the delete
  and never resurrects, but the edit is gone.
- **Both changed one entry.** The newer `updatedAt` wins whole; fields are not merged.
- **Consent flags on an event.** If both tabs change the same consent event (one marks it `sent`, the other `failed`),
  this tab's copy wins; at worst the event is sent again, and the server keeps one row per account and client id (`consent_events_client_id`).
- **Not atomic across processes.** Each write is read, merge, write in one task. Browsers do not lock localStorage
  between tabs, so two tabs writing within the same few milliseconds could still race; the window is now one task,
  not "as long as the tab was asleep".
- **Cost.** Each read checks a short token; each save reads the stored text once more and writes the token. A merge
  parses the stored copy and the base and compares entries as JSON, only when another tab wrote.
- **Other writers.** A page that writes `ovumind_db_v1` without this file (none today) changes no token: reads would
  not notice, but every write still merges. Entries without a string id, from a foreign writer, get a new id on each
  read and cannot be matched across tabs.

## Checks

- `tools/test-core.js`, `twoTabsShareOneStore`: the scenario above; edits and deletes both ways; editing an entry
  deleted elsewhere; consent order both ways with `profile.cloud` following; failed `commit` and `add` in a stale tab
  and the retry; one period a day across tabs; a summary pushed onto the live copy; Delete everything in either tab;
  and the four review findings. The new checks fail on the base (14) and the review ones on the first version (4).
- `tools/e2e_smoke.py`: two pages in one context, tab A ignoring storage events; then the storage event path still
  shows the other tab's save without a write.

## Open questions for Jamie

1. Hearts and other game counters: is losing one tab's same-key change acceptable when two tabs are open (rare on a
   phone), or should hearts move to a per-operation log?
2. Edit against delete: should a deleted entry win (now), or should a later edit bring it back?
3. Should the app warn when it is open in two tabs (the web lock API can tell), or is a silent merge enough?
