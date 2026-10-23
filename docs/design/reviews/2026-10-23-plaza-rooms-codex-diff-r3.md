HOLD

## A. Open round-2 items

`SQL` means `supabase/migrations/20261022120000_plaza_rooms_chat.sql`. FIXED items retain their original severity and need no further fix for that finding.

| Item | Verdict | Severity | Evidence and result |
|---|---|---|---|
| A3 | FIXED | P1 | `SQL:467`, `ovu-rooms.js:287`: one visible-window snapshot and fingerprint deliver approvals regardless of commit order. |
| A4 | FIXED | P2 | `ovu-rooms.js:211`, `ovu-rooms.js:281`: read denial closes the room’s sheets and clears its feed. |
| A6 | FIXED | P1 | `ovu-plaza.js:224`: the staff group/room exception is unconditional. |
| A7 | **NOT FIXED** | **P1** | `SQL:313`, `SQL:506`, `ovu-rooms.js:122`: ordinary direct instructions such as “Stop citalopram” and “Take amoxicillin” produce no hold and publish immediately in live mode. **Smallest fix:** hold direct prescription instructions independently of the finite medicine list, or enforce review-only operation. |
| A8 | FIXED | P1 | `ovu-rooms.js:557`, `ovu-rooms.js:567`, `ovu-rooms.js:583`: menu actions check adult eligibility and read access; the age tick closes sheets at `ovu-rooms.js:296`. |
| A10 | **NOT FIXED** | P2 | `SQL:290`, `ovu-rooms.js:76`: ordinary web addresses including `medlineplus.gov` and `hse.ie` still pass. **Smallest fix:** replace the partial suffix list with general domain recognition on both sides. |
| B1 | FIXED | P1 | `ovu-rooms.js:459`: delayed consent cannot submit a different room’s draft or changed text. |
| B2 | FIXED | P1 | `SQL:545`: every explicit Off records a withdrawal and invalidates older consent forms. |
| B3 | **NOT FIXED** | P2 | `ovu-rooms.js:572`: Report with “Also block her” bypasses the new invalidation path, so an older feed reply can retain blocked messages. **Smallest fix:** apply the author filter and `refetch()` used by standalone Block. |
| B4 | FIXED | P2 | `admin.js:317`, `admin.js:429`, `admin.js:443`: the open Queue fetches messages and reports periodically and on visibility restoration. |
| B5 | FIXED | P2 | `admin.js:300`, `admin.js:353`: rejected room Show/Hide feedback survives redraws. |
| B6 | FIXED | P2 | `ovu-rooms.js:410`, `ovu-rooms.js:421`: incoming messages preserve an upward reader’s scroll position. |
| B7 | FIXED | P3 | `SQL:467`: visibility, IDs, bodies and fingerprint share one statement snapshot. |
| B8 | FIXED | P3 | `SQL:405`: Last message uses the viewer’s visibility predicate. |
| B9 | FIXED | P3 | `admin.js:272`: the staff notice discloses room-message group and room context. |

Review mode mitigates A7 at launch, but the implemented live path still publishes direct prescription instructions without review. The additional A7/A10 examples are ordinary instructions and addresses. Current fixtures omit them. B3’s smoke case explicitly reports with `p_block:false`.

## B. New findings, ranked by severity

1. **P2: a stale staff decision reverses an earlier moderation decision.**  
   `SQL:604`, `SQL:606`: two owners see a held message; one Hides it, then the other’s stale Show silently republishes it. **Smallest fix:** require the displayed revision and held status after locking, returning stale when another decision intervened. **Tests:** missed by dry run, races, smoke and core; room races cover withdrawal versus Show, not conflicting decisions. Source-derived.

2. **P2: a delayed Send reply restores a message after Room chat Off.**  
   `ovu-rooms.js:484`, `ovu-rooms.js:495`: after successful withdrawal and an empty fresh feed, an older successful Send reply still inserts its deleted message and announces it was sent. **Smallest fix:** invalidate pending send results on withdrawal using a mutation generation or captured consent event. **Tests:** missed by all four suites; Off smoke delays feed replies, not Send replies. Reproduced with mocked I/O.

3. **P2: withdrawn or hidden messages remain quoted in an open Report sheet.**  
   `ovu-rooms.js:287`, `ovu-rooms.js:557`, `ovu-rooms.js:564`: a fresh feed removes the message, but its full copied body and menu remain indefinitely. **Smallest fix:** invalidate the selected-message sheet when its ID leaves the visible window, and require current message visibility before acting. **Tests:** missed by all four suites; existing sheet coverage tests whole-reader denial. Reproduced.

4. **P2: delayed room actions close another feature’s sheet.**  
   `ovu-rooms.js:537`, `ovu-rooms.js:572`, `ovu-rooms.js:587`: opening another sheet while Room chat On, Report or Block is pending lets the eventual success close that newer sheet, interrupting unsaved work. **Smallest fix:** close only the initiating sheet if it remains current. **Tests:** missed by all four suites. Reproduced for Room chat On followed by a profile-edit sheet.

5. **P2: older Join requests override newer room choices.**  
   `ovu-rooms.js:429`, `ovu-rooms.js:433`, `SQL:433`: a delayed Chat join arriving after a successful Vent join moves membership back to Chat while its discarded reply leaves Vent looking joined until polling. **Smallest fix:** serialize joins and reconcile the latest requested room, following the existing Plaza join loop. **Tests:** missed by all four suites; current joins are sequential or test capacity contention. Reproduced with mocked server ordering.

6. **P2: hiding and showing a card can exceed room capacity.**  
   `SQL:271`, `SQL:425`: one of twelve members hides her card, another takes the apparently free place, and showing the original card restores thirteen counted memberships. **Smallest fix:** reserve capacity for every active membership, or end membership when hiding and require a capacity-checked rejoin. **Tests:** missed by all four suites; hidden-author tests never fill the freed slot before restoration. Source-derived.

7. **P2: failed report decisions still lose their feedback.**  
   `admin.js:342`, `admin.js:346`: rejected Pause, Remove or Dismiss writes an error into `reportsMsg`, then redraw immediately erases it. **Smallest fix:** persist report-decision feedback across renders, matching `roomMsgsNote`. **Tests:** missed by all four suites; smoke tests successful Pause only. Reproduced. This pre-existing report-path defect remains reachable from room reports.

8. **P2: older report requests overwrite the selected filter.**  
   `admin.js:279`, `admin.js:349`: an open-only refresh resolving after “Show decided too” replaces the newer all-status result, hiding decided reports under the wrong filter state. **Smallest fix:** bind replies to both request generation and captured filter. **Tests:** missed by all four suites. Reproduced.

9. **P3: delayed consent does not preserve room-entry identity.**  
   `ovu-rooms.js:459`: leaving and rejoining the same room while consent is pending can submit the unchanged draft through the replacement entry. **Smallest fix:** capture and compare `pend.entry`, as the subsequent send context already does. **Tests:** missed by all four suites. Reproduced; the room and text remain unchanged, which limits its severity.

Verification: **1,834 core checks passed**, plus JavaScript and Python syntax checks. Database dry run, races and browser smoke were inspected, not rerun. No files were edited or migrations applied.