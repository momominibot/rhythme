# Prevent deleted local data returning from stale pages

Completed 11 September 2026. Scope: `acupoints.html` and `hydration.html` only.

## Reproduced bug

Acupoints loaded its routine array once and later saved the entire cached array. In an isolated reproduction using its actual inline code, the page loaded `['sp6']`, Settings deleted the exact local store, then adding ST36 from the already-open page restored `['sp6','st36']`. Hydration similarly held its entire log in memory and wrote it on Add, Undo and weight changes. A success message asking users to reload other tabs did not prevent restoration.

## Change

Both writers now remember the exact storage string they loaded and compare it with current storage immediately before saving. If the record changed or was deleted elsewhere, the writer refuses the stale save and shows persistent reload guidance. A candidate change becomes the displayed selection/log only after the write succeeds; failed saves preserve existing display state and custom input, with no success toast. Their snapshot advances after each successful local save, so normal successive edits still work.

Unreadable, malformed and unsupported saved records block writes and keep their original bytes. Acupoints removal also works without a bookmark element; the former optional-element dereference could throw before saving. Existing keys, design, calculations, extra valid hydration fields and unrelated stores are preserved.

## Verification

`node scripts/check-stale-writers.cjs` executes the actual inline page scripts with synthetic storage and a minimal DOM. All 14 groups pass: reviewed deletion, external replacement, Add/Undo/weight routes, successful successive writes, failure/retry, original selection/input preservation, malformed/unsupported storage and fresh empty storage. The checked-in receipt is `stale-writers-regressions.json`. Both inline scripts parse and `git diff --check` passes.

This is not a browser/native layout check or atomic compare-and-swap: localStorage offers no multi-operation transaction, so a truly simultaneous cross-context write between comparison and persistence remains an architectural limitation. Protected transactional storage belongs to the production data layer.

## Bounded adjacent review

The reviewed Home check-in, Labs, ovarian-assessment, PhenoAge, label-scan, sleep, stress and wellness-journal writers read the stored collection when saving rather than restoring an entire page-load copy. No additional exact whole-history resurrection path was identified in those inspected save functions. This does not mean every app write or every stale form edit has been audited; explicit resubmission of an old open form is a separate behavior, and several legacy pages retain unrelated clinical/demo issues.

No real user records were read or removed; no deployment or commit was made by this subtask.
