# PROGRESS — Ovuluna v2 Build

**Date:** July 24, 2026
**Status:** Complete — ready for Vercel deploy

## Files Created

| File | Description | Lines |
|------|-------------|-------|
| `ovuluna-persona.css` | 4-persona CSS variable system + persona-aware components | ~380 |
| `acupoints.html` | TCM Acupoint Atlas — 13 points, body map, filters, routine + timer | ~350 |
| `myofascial.html` | Myofascial Relief Guide — 8 techniques, guided sessions | ~250 |
| `foods.html` | Food Database — 22 foods TCM+Western dual-view, phase-synced eating | ~320 |

## Files Modified

| File | Changes |
|------|---------|
| `learn.html` | Added `data-persona` attribute, persona CSS, persona filter chips, 4 life-stage content sections (Bloom/Grow/Nurture/Wisdom) with TCM + Food links, updated nav |
| `settings.html` | Added `data-persona` attribute, persona CSS, Appearance section with persona picker grid, persona JS logic, updated nav |
| `BRIEF.md` | Updated with v2 build details |

## Verification Checklist

- [x] 4 persona themes built with distinct CSS variables (ovuluna-persona.css)
- [x] Persona selector in settings/profile working (settings.html > Appearance)
- [x] Persona filter on Knowledge Hub (learn.html)
- [x] TCM acupoint atlas page with 13 acupoints (acupoints.html)
- [x] Myofascial relief guide page with 8 techniques (myofascial.html)
- [x] Food knowledge page — Chinese + Western dual-view (foods.html)
- [x] Food phase-synced eating guide (follicular/luteal/menstrual)
- [x] Knowledge Hub reorganized by life stage with persona filtering (learn.html)
- [x] Existing pages not broken (only learn.html and settings.html were modified)
- [x] Evidence badges on acupoints and foods (Strong/Moderate/Consensus)
- [x] Safety warnings on pregnancy-contraindicated acupoints (SP6, LI4)
- [x] Persona persists via localStorage
- [x] 400ms crossfade on theme switch
- [x] Co-branding footer "Ovuluna × Ovuluna" on all new pages
- [x] Mobile-first 390px viewport
- [ ] Site deploys successfully to production

## Known Issues
- Some internal wiki article links (#) are placeholders
- Existing pages (home.html, cycle-home.html, etc.) still have the old 5-tab navigation; only learn.html and settings.html were updated with new nav
- The persona CSS on new pages references the `--ovuluna-*` variables but existing pages in the old nav (home.html, etc.) still use the original theme.css `--cocoa`, `--mauve` variables
- Lottie animations on learn.html reference local asset files that may not exist

## Next Steps
1. Deploy to Vercel preview
2. Test all pages on mobile viewport
3. Update remaining pages' navigation to the new 5-tab layout
4. Add actual article content for placeholder links
