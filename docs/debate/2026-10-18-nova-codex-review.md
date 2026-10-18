Read-only review complete. No files changed. Existing tests pass **68/68**, but miss several material defects.

The principal problem is measurement validity: unresolved cooked dishes contribute denominator calories while their possible NOVA 4 ingredients contribute nothing to the numerator.

These assignments need correction or qualification. NOVA depends on ingredients and processing, so several names cannot support one definite group. [Monteiro et al. 2019](https://doi.org/10.1017/S1368980018003762).

| Exact assignment | Correct treatment and reason |
|---|---|
| **Soy milk (no topping): 3** | **1**, if its HPB description of soybeans and water is complete; added sugar or industrial formulation changes classification. |
| **Kopi, Kopi C/O, Iced Kopi; Teh, Teh C/O/Tarik/halia, Iced Teh: 3** | Ingredient mixtures, not automatically 3: coffee/tea **1**, sugar **2**, plain milk **1**, simple sweetened condensed milk **3**, formulated creamer potentially **4**. |
| **Otah; Fishcake: 4** | Unresolved preparation; traditional fish-and-seasoning recipes do not establish industrial ultra-processing. Formulated versions can be **4**. |
| **Ice kacang: 4** | Unresolved mixed dessert, consistently with **Chendol**; gula melaka does not establish 4, whereas formulated syrups may contribute it. |
| **White bread; Toast; Whole-wheat bread: 4** | **3** for simple flour/water/yeast/salt bread; **4** with characteristic industrial ingredients. Colour or toasting is insufficient. |
| **Corn flakes: 4** | **1** plain, **3** with sugar, **4** with flavours/colours. |
| **Almond milk, unsweetened; Soy milk, unsweetened: 1** | Conditional: “unsweetened” does not exclude isolates, flavours or emulsifiers. |

Fresh **prata** and **kaya and butter toast** can remain unresolved dishes, but unflagged does not mean UPF-free. **Yong tau foo** warrants “possible components”, since selected pieces vary. **Tau huey: 3** is not categorically wrong for its tofu base, but syrup/formulated pudding needs distinction. **Bubble tea with milk: 4** is plausible, not established by its name. **Milo** powder being 4 is reasonable; added milk needs separate treatment when quantities are known.

A separate dish bucket is defensible **as uncertainty handling**, not as a fifth NOVA group or assumed non-UPF energy. Ingredient disaggregation is established practice, including standard recipes; industrial products themselves should remain intact. [CDC methods](https://www.cdc.gov/nchs/products/databriefs/db536.htm), [NCI implementation guidance](https://epi.grants.cancer.gov/nova/).

Without recipes now, retain “recipe unresolved”, disclose coverage and withhold the overall percentage. Excluding other unknown foods can bias results either way, so the current metric is not reliably a lower bound.

The ranked changes are:

1. **Correct the denominator:** `ovu-nova.js:71–72`. Cooked dishes, especially `cooked*`, cannot silently count as fully classified non-UPF energy. Remove the research-equivalence claim at `room.js:116`.

2. **Preserve missing-energy status:** `ovu-nova.js:62`. Missing nutrients, null/blank/invalid kcal and measured zero all become zero. Track missing-energy items separately; zero-calorie UPFs also demonstrate why energy share cannot establish food absence.

3. **Replace the false absence headline:** `ovu-nova.js:79`. Banana 100 kcal plus cola with missing kcal produces **“No ultra-processed foods”**. So does cola 1 kcal plus banana 1,000 kcal through rounding. Use qualified wording and `<1%` where appropriate.

4. **Fix first-match precedence:** `ovu-nova.js:21,50`. Reproduced **NOVA 1** for “White rice crackers”, “Brown rice with luncheon meat” and “Bubble tea with green tea”. Restrict whole-food matches to whole-item templates and handle composites first.

5. **Validate OFF values strictly:** `ovu-nova.js:44–45`. Strings `"3"` and `"4"` work correctly. However, `"3.5"` is accepted, creates `NaN` buckets and loses energy; `true` becomes group 1. Accept only numeric/string integer groups 1–4.

6. **Normalize separators:** `ovu-nova.js:23`. “3 in 1 kopi” becomes 4, but **“3-in-1 kopi” becomes 3**. Add punctuation variants and regression cases.

7. **Replace categorical food defaults:** `ovu-nova.js:22–24,28`, using the foods above. “Dark chocolate 70-85%” also needs ingredients rather than an unconditional group-3 exception. Fish paste alone cannot prove UPF.

8. **Align displayed denominators and weekly coverage:** `room.js:629`; `ovu-agents.js:86`. The existing fixture gives headline **20%** but legend **18%**. Weekly output omits classification and missing-energy coverage.

9. **Refine the guide:** `room.js:116`. Its association-versus-causation wording and “not a verdict” are good. Replace “how much” processing with its **nature, extent and purpose**, and “NOVA scores ingredients, not mixed dishes” with a qualified disaggregation explanation.

10. **Offer a number-free mode:** `room.js:621,635,638`; `ovu-agents.js:86`. Hide percentages, calorie totals, evaluative colours and weekly processing summaries. Repeated scores and “No UPF” can encourage purity rules. This is a precautionary recommendation: calorie-tracking research identifies concerns in eating-disorder populations but does not establish causation or prove this safeguard effective. [Levinson et al.](https://pmc.ncbi.nlm.nih.gov/articles/PMC5700836/).

