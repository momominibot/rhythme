**The strongest giveaway is the window boundary, followed by inconsistent lighting. More blur will make this worse.**

In descending visual weight:

1. **Cyan edge contamination.** Image 2 has a pale blue ribbon around the upper and left opening. The 6 px inset leaves daytime pixels exposed; the 9 px feather blends the night sky into them. Against navy, that ribbon reads as a pasted boundary.

2. **Bevel lighting.** The right and lower inner reveal retain a broad, almost white highlight. Beside the dark replacement, this reads like an illuminated border rather than cream material receiving coherent light.

3. **Wall spill and contrast.** The surroundings retain their daytime brightness while the opening becomes a deep purple patch. Warm indoor lighting is perfectly plausible at night, but the window’s apparent contribution to nearby illumination needs reducing.

4. **Focus and material mismatch.** The moon and clouds are noticeably smeared compared with the frame and shelf. The repaint’s clouds also have more billowing detail than the original’s simple clay forms. Soft rendering is not the same as uniformly blurred rendering.

5. **Moon and colour.** The clean yellow crescent and diffuse halo read as an illustrated symbol. Its strong yellow-purple contrast attracts attention to the inserted layer.

**My compositing recipe:** treat the opening and inner bevel as one lighting repair, while preserving the original frame geometry.

All values below are starting points at the supplied **500 px crop width**, scaled proportionally for larger files.

- **Register first.** Align the repaint to the original opening using a local warp. Image 3 changes proportions; simple resizing will not align every edge.
- **Replace the complete sky.** Extend replacement pixels **2–3 px beneath the original frame**, then place the frame above them. Use approximately **0.5–1.5 px feather** at the actual aperture boundary. Remove residual cyan contamination rather than feathering through it. [Adobe’s fringe guidance](https://helpx.adobe.com/photoshop/desktop/make-selections/refine-modify-selections/fringe-pixels-around-a-selection.html) explains this retained-background problem.
- **Keep the original frame band.** Selectively grade its inner reveal with **2–4 px mask feather**. Start by lowering the brightest reveal **0.3–0.6 stop**, reducing yellow, and introducing restrained lavender into shadowed surfaces. Preserve its dimensional shading and contact shadows.
- **Relight the adjacent wall subtly.** Reduce apparent window spill with a broad **40–80 px feather**, initially **0.2–0.4 stop**. Preserve warm pools around fairy lights; avoid an oval dark halo.
- **Match the insert.** Start from unblurred raw pixels, downsample once, then judge at final size. Slightly lift and desaturate the navy. Give the crescent gentle surface shading and a tighter, weaker glow.

For a whole-room night state, **relight the entire original plate**. A generated full-night plate can guide lighting, but prompting cannot guarantee identical furniture. Transfer only smooth lighting and colour changes onto the original, preserving silhouettes and details. If the actual 3D scene exists, rerendering that same scene with night lighting is the strongest route.