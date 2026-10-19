# Her look: hairstyles, hair and eye colours, skin tones (19 October 2026, design note)

Jamie: "Where's the designing/customizing of the character I have mentioned yesterday? ... Let's start with 4 hairstyles
but different color hair and eyes and 4 skin colors." The other session's brief (condensed): decide a first set of looks
in the same chibi clay proportions; design the production plan before rendering, because full combinatorics times
every outfit, pose and walk strip is too many renders; name looks by appearance, never ethnicity; a tudung option must
sit naturally and stay on in every pose and outfit including pyjamas; key with the largest shape, scale each sprite so
the head width matches the original, compare every sprite on a contact sheet and regenerate drift; one resolver
wherever an avatar path is built, with a fallback to the current look when a file is missing; a "Your look" picker in
You beside Wardrobe with a preview in the current outfit, the same choice in onboarding; varied neighbours; tests.
Nothing may change her look automatically.

## What a look is made of, and what it costs

Today one character is baked into every sprite: 10 standing outfits, 9 everyday poses, meditate, sleeping, the sit
pose (pending), and 8 outfits x 3 directions of walk strips (27, two pending), about 50 renders. Four hairstyles mean
four of everything: about 200 renders at 40 seconds each, nearly three hours of generation across several batches
(the batch stops on the first provider failure, no retries), plus a slice and a contact sheet each. That is the price
of hairstyles, because hair changes the silhouette in every frame. Hair colour, eye colour and skin tone are colour
changes inside a fixed silhouette, so they do not need renders if the recolour can look native.

## The plan

1. **Four hairstyles, one render pass each.** Keep the current bun (style 1). Add three with distinct silhouettes that
   read at 60 px: a long straight fall with a side part, a short bob with a fringe, and a high ponytail. The tudung is
   a fifth "hair" in production terms: a soft wrap in a plain colour that covers the hair and neck, rendered like a
   hairstyle so it stays on in every pose, outfit and walk frame (pyjamas included; the sleeping sprite keeps it as a
   loose night wrap). Each is produced by reference edits of every existing sprite with the same prompt discipline as
   the walk strips ("keep this exact same girl... only the hair is now ..."), keyed with the largest shape, scaled by
   head width to the original, placed on a contact sheet beside the original, and regenerated where the face or
   proportions drift.
2. **Hair and eye colour by masked recolour, decided by a test first.** Render style 1's standing sprite twice more
   from the model with different hair colours and compare against a masked recolour of the original (mask from the
   chroma render's hair region by colour distance to the known lavender-grey, feathered; hue and lightness shift only,
   highlights kept). If a careful reviewer cannot tell the recolour from the render, hair colour and eye colour become
   runtime recolours (a canvas pass once per sprite, cached as a blob URL, same on every frame of every strip), with
   six hair colours (lavender grey as now, black, dark brown, chestnut, honey blonde, soft pink) and five eye colours
   (violet as now, brown, hazel, green, grey). If the recolour looks painted on, hair colour becomes three preset pairs
   per style rendered by the model, and eye colour stays a recolour (the iris is tiny and flat-lit).
3. **Four skin tones by masked recolour too, with a stricter test.** Skin spans the face, arms and legs in every
   outfit; a colour-distance mask to the known peach plus a feather, shifting hue, saturation and lightness together
   toward each target (light peach as now, warm sand, golden tan, deep brown), and a check that the blush, lips and
   shadows still read. If the deep brown tone looks grey or flat, that tone is rendered by the model per style instead.
4. **A resolver, one place.** `OvuLook.src(kind, name)` builds every avatar path (`avatar-<look>-<outfit>.webp`,
   `avatar-<look>-act-<pose>.webp`, `avatar-walk-<look>-<outfit>-<dir>.webp`, meditate, sleeping, sit) and falls back
   to the current look when a file is missing, so a half-produced look never breaks the room; every place that reads an
   `avatar-*.webp` goes through it (setOutfit, setPose, the sitter, the walk strips, the You card, the wardrobe).
   The chosen look lives in `profile.look` with the current look as the default; a recolour needs the base sprite and
   the colour choice, cached per sprite.
5. **Picker.** "Your look" in You beside Wardrobe: four hairstyles in a row (plus the wrap), hair colours, eye
   colours, skin tones, each a tap with a live preview of her in the current outfit; the same chooser in onboarding
   where the name is asked. Nothing changes her look by itself, not night, not outfits, not sessions.
6. **Neighbours vary** once the looks exist: Mei, Nadia, Priya and Sofia each get a different look, named by
   appearance in code (bob-dark, long-honey...).
7. **Tests.** Core: the resolver falls back; every look listed has every outfit, pose and strip on disk, or the
   fallback covers it; the recolour masks never touch pixels outside the hair or skin set (checked on fixtures).
   Smoke: choosing a look changes the avatar image and stays after reload; the wardrobe still changes the outfit only.

## Order of work

1. The recolour test (one evening): three renders, one mask script, one contact sheet, Jamie's eye and a Codex look.
2. Style 2 end to end (bob): all sprites, contact sheet, resolver, picker with one extra choice, tests, push.
3. Styles 3, 4 and the wrap, one per push; colours per the test's result.

Pending the recolour test, the budget is 150 to 200 renders and about four evenings.
