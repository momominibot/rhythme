Reproduced with Node and the real `OvuOrb.urgent`, comparing HEAD with delta4 reversed in memory.

| Reported regression | Result |
|---|---|
| Headache with “very blurry” / “everything looks blurry” | **FIXED**: `HEADACHE_VISION_NOW` |
| Arm numb “with no pain from sleeping on it” | **FIXED**: `null` |
| “Chest pain: not really” | **FIXED**: `null` |
| COVID positive line / pregnancy test “never turned positive” | **FIXED**: both `null` |

New defects introduced:

- **P1, `ovu-orb.js:109–110`:** “My arm went numb but not due to sleeping on it” changes `STROKE_NOW → null`. Keeping only two preceding words drops “not”, accepting an explicitly denied explanation.

- **P1, `ovu-orb.js:121`:** “Chest pain: not really improving” changes `CHEST_BREATH_NOW → null`. The new denial pattern accepts the prefix “not really” without requiring the answer to end.

- **P2, `ovu-orb.js:142`:** “I have a bad headache after editing blurry photos” changes `null → HEADACHE_VISION_NOW`, including **Call 995**. Bare `blurr\w*` incorrectly treats photographic blur as impaired vision.

- **P1, `ovu-orb.js:152`:** “Pregnancy test was never positive before. Pregnancy test is positive today and I am bleeding” changes `PREG_BLEED_NOW → null`. Only the first, denied test result is examined.

- **P1, `ovu-orb.js:157`:** “No pain + positive pregnancy test + spotting” changes `PREG_BLEED_NOW → null`. The preceding “no pain” incorrectly negates the affirmative pregnancy result.