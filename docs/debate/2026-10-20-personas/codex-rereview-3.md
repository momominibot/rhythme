Reviewed HEAD `86e82bb`: **10 FIXED, 1 NOT FIXED** for the previously reported scenarios. `node tools/test-core.js`: **799 passed, 0 failed**. No files edited.

R1–R8 below follow the eight new findings’ order in `codex-rereview-2.md`.

| Item | Status | Evidence |
|---|---|---|
| O10: Luna warning replay | **FIXED** | Restores `careOn` and ends moments. `room.js:1731` |
| O13: Tudung outfit | **NOT FIXED** | Still selectable/persisted with zero matching assets; thumbnails break. `room.js:122`, `room.js:490`, `room.js:1356` |
| N7: Postpartum return button | **FIXED** | Reopening recreates the choice after today’s medium-flow/pain-10 save. `room.js:810` |
| R1: Postposed denial | **FIXED** | Both reported chest-pain examples retain warnings. `ovu-orb.js:120` |
| R2: Stroke exclusion | **FIXED** | “No pins and needles” no longer suppresses weakness. `ovu-orb.js:109` |
| R3: Missed voices warning | **FIXED** | “No one else” survives negation checking. `ovu-orb.js:118` |
| R4: Radio false alarm | **FIXED** | Ordinary-source filtering applies. `ovu-orb.js:139`, `ovu-orb.js:187` |
| R5: Denied blurry vision | **FIXED** | Reported denial returns no warning. `ovu-orb.js:141` |
| R6: Pregnancy-window examples | **FIXED** | Both reported examples produce expected results. `ovu-orb.js:154` |
| R7: Stale care flag | **FIXED** | Replacement sheets clear it. `room.js:525` |
| R8: Contradictory confirmation | **FIXED** | Suspended users receive paused wording. `room.js:813`, `room.js:842` |

**New concrete regressions**, reproduced against `HEAD^` using the actual matcher:

- **P1:** “Severe headache and my vision is very blurry” changes `HEADACHE_VISION_NOW → null`. The narrowed vision pattern rejects ordinary modifiers; “everything looks blurry” also fails. `ovu-orb.js:141`. This misses an [MOH emergency-department indication](https://www.moh.gov.sg/seeking-healthcare/getting-medical-help/conditions/headaches/).

- **P2:** “My arm went numb with no pain from sleeping on it” changes `null → STROKE_NOW`, instructing 995. `explained()` treats “no pain” as denying the sleeping explanation. `ovu-orb.js:109`.

- **P2:** “Chest pain: not really” changes `null → CHEST_BREATH_NOW`, instructing 995. Postposed “not really” support was removed. `ovu-orb.js:120`.

- **P2:** New pregnancy false alarms: “My COVID test shows a positive line and my period started today” and “My pregnancy test never turned positive, period started today” both change `null → PREG_BLEED_NOW`. The first loses preceding test-type context; the second’s newly added reverse-order branch ignores negation. `ovu-orb.js:151`, `ovu-orb.js:154`.