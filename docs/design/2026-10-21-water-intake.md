# Water in the food diary (design v2, 21 Oct 2026, after the Codex review)

Jamie, 21 Oct: "Let's put water intake under food diary. Today's check-in should put water intake instead of food. Based on weight to calculate how much water intake required a day? Reward user points who have drink that amount of water but we need to factor in if they have any kidney disease. We don't want to stress the kidney."

Codex's design review (`docs/debate/2026-10-21-water-codex-design.md`) returned REVISE with ten required changes. v2 takes all ten. The two that change Jamie's words, and why:

- **No personal "amount you require" and no weight formula in this version.** The per-kilogram rule (30 to 35 ml/kg) is NICE CG32's clinician-managed nutrition-support figure for total fluid from every source, not a drinking target for a well person; EFSA, HPB and the NHS give population figures for total water including food. Showing a personal number beside a plain-water log reads as a target even when it is called a guide. The strip shows general drinking information instead, with its sources, and never a number she "requires".
- **Hearts for recording, never for reaching a volume.** The app's economy rule (one logging award per kind a day, nothing for amount, nothing for a health outcome) and the four-persona review both forbid volume rewards; a once-a-day reward at a threshold still nudges someone past discomfort or a restriction. The first water record of the real day earns the same six hearts as the first meal, in every mode. This is also what keeps the kidney in mind: nobody is ever paid to drink more.

## 1. What is built

- **Where**: the food diary's Today pane, a water strip above the day's entries: "Water recorded today: 750 ml", "Add water you already drank" with 250 ml, 200 ml, 500 ml (named as examples: a glass, a cup, a small bottle vary) and "Other amount", today's records with Remove, and "General drinking information" folded under the strip.
- **Today's check-in**: the Food tile becomes a Water tile (key by default, as Food was). Recorded, or the answer "Not recording water today", completes it; neither says anything about adequacy. Food keeps its own logging hearts and is logged in the diary as before; historical food skip answers are never read as water answers; an existing "food does not count" choice carries over to water once, then she chooses as before.
- **Screening, optional**: before the first record the strip asks four short questions; she can decline and log anyway. Not sure is stored as not sure. The answers decide only which information line shows; they never change the hearts.
- **Hearts**: six for the first water record of the real day, under the existing once-per-kind rule and the forward-only day watermark; nothing for more water, a guide, editing, Remove and re-add, a backdated day, an import, the tick or the skip answer. Equal in every mode.
- **Data**: `state.water = { v: 1, settings: { answers, declined, bf, hideNumbers }, records: { id: { id, date, ml, at } }, tombstones: { id: deletedAt } }`, written with the rewards ledger in one `OvuStore.commit` so a failed save takes neither (the `thank()`/`spend()` pattern). Day totals are derived. Records are merged by id across tabs (added in either tab kept, a tombstone wins over a record, the newer `at` wins a changed record), so two tabs logging at once lose nothing and a stale tab never resurrects a wiped diary (the store's key-by-key merge keeps the whole `water` key: the module merges inside it before every write, reading the stored copy first). In the diary export; restored by the journal's Restore through a validated, idempotent `OvuWater.restore` (no hearts from a restore; screening re-asked when the answers are older than the restore). Not in cloud backup in this version, and the strip says so. Delete everything deletes it.

## 2. General drinking information (shown as information, with sources, not as her number)

- "Most adults do well on about six to eight cups or glasses of fluid a day; water, milk, tea and coffee all count, and so does fluid from food. Pale yellow urine is a reasonable sign for most adults (not a reliable one in older age)." NHS; HPB (eight glasses, about two litres, including fluid from food); EFSA 2010 total water 2.0 L a day for women including food, under moderate temperature and activity.
- "Pregnancy and breastfeeding raise the need (EFSA: about 300 ml and 700 ml more total water a day). Hot days, exercise and illness raise it too." EFSA; HPB; NHS.
- "Drinking far beyond thirst can lower the sodium in your blood. Drink to thirst around exercise." NAM 2005 (no upper level; acute water toxicity when intake greatly exceeds roughly 0.7 to 1.0 L an hour), Hew-Butler 2017.
- "Had kidney stones? The NHS and NICE advise 2.5 to 3 L of water a day for prevention; if your clinic gave you a number, use theirs." NHS, NICE NG118.
- "Kidney disease, dialysis, heart failure, low blood sodium or SIADH, cirrhosis with ascites, lithium, pre-eclampsia or any fluid advice from your care team: follow your care team. This log records plain water only, so it does not show your total fluid intake." (CKD WIT 2018: coaching to drink more did not significantly slow kidney function decline over a year in stage 3 CKD, with power limits; KDIGO and the heart failure consensus individualise fluids; KASL: restriction is not routine in ascites; SPS: lithium needs adequate fluid and care with changes.)

No climate multiplier, no urine-colour rule for older adults, no number next to her total.

## 3. The questions (optional; Not sure stays Not sure; Decline is allowed)

1. Kidney disease or dialysis?
2. Heart failure, low blood sodium or SIADH, cirrhosis with ascites, or lithium?
3. Has a doctor given you advice about how much to drink (more or less)?
4. Pregnant, possibly pregnant, pre-eclampsia, or breastfeeding now? (Breastfeeding is its own tick here, editable, whatever the intro said; postpartum alone adds nothing.)
Plus a switch: "Hide amounts" (shows records as a count, not millilitres) for anyone who prefers no numbers, no reason asked.

Information shown: care-team line when any of 1 to 3 is yes or not sure; the pregnancy and breastfeeding line when 4 is yes; the general lines otherwise. Declined screening: logging works, the general information shows, the care-team line is always one tap away.

## 4. Copy rules

"Water recorded today", "Add water you already drank", "Other amount", "General drinking information", "Not recording water today", "Saved on this device. Water records are not included in cloud backup yet." Never "goal", "target", "remaining", "on track", "complete", "dehydrated", no percentages, no fill bars, no celebration animation, no catch-up prompt. Screening answers stay in local state, never in `profile`.

## 5. Legacy and privacy

- `hydration.html` (`ov_hydro`, 35 ml/kg goals and cycle-temperature claims) is retired to a redirect stub into `room.html#food` as the other old screens were; its records stay in `ov_hydro` untouched, and the strip offers "Bring in old water records" once (idempotent import, no hearts).
- `privacy.html` and `privacy-local.js` name the water records and screening answers under the diary key, local only even with cloud backup on.
- Structured water records and screening answers are never put into Luna's prompts, the summary agents, the PDF, the clinician share or cloud payloads (tests mock the enabled paths). A note she writes about water is her note and is handled as any note.

## 6. Evidence entries (topic `water`, E95 to E101; E17 already cites EFSA and stays)

E95 ESPEN 2022 R61 (older women at least 1.6 L of drinks a day, Grade B, clinical exceptions). E96 HealthHub, The best refreshment (HPB). E97 NHS, Water, drinks and hydration. E98 NAM 2005 DRI for water (2.7 L total for women, about 80 percent from beverages, no UL, acute toxicity). E99 Clark 2018 JAMA CKD WIT. E100 Hew-Butler 2017 Front Med. E101 NICE NG118 renal and ureteric stones (2.5 to 3 L). HealthHub heart failure fluid page is linked from the care-team line (contributor NHG Health).

## 7. Tests

Core: record add/remove/merge (two tabs, add versus remove, duplicate taps, wipe versus stale save, replacement import), derived totals by date, invalid amounts (zero, negative, nonfinite, huge, strings), atomic commit of record plus reward (failed write leaves both untouched), one award a day across modes and amounts, nothing from edit, remove and re-add, old dates or imports, screening states (incomplete, declined, not sure, overlapping, care over pregnancy), breastfeeding independent of postpartum, restore idempotent with no hearts, structured exclusion from AI, summary, PDF and share payloads, privacy wording, legacy import. Smoke: the strip before and after screening, declined screening, care line, three records with hearts once, Water tile and its answer, old food skip not read as water, reload and a second tab, night contrast, keyboard, hydration.html redirect.
