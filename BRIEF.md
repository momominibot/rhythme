# BRIEF — Ovuluna v2 · TCM-Integrated Ovarian Health Platform

## Goal
Evolve Ovuluna from a general women's health app into a TCM-integrated ovarian health standalone app. Add acupoint/myofascial relief guidance, evidence-based Chinese + Western food tracking, and a life-stage persona system where each profile (teens, TTC, post-pregnancy, pre/post-menopause) gets its own themed interface. Deploy to Vercel production.

## Core Vision
Ovuluna is the co-pilot app for Ovuluna surfaces evidence-based science through a beautiful, persona-adaptive interface. TCM wellness is a first-class feature: acupoints, myofascial relief, and food as medicine — all evidence-based, blending Eastern and Western knowledge.

## Constraints
- Must preserve existing Ovuluna watercolor design system as the base
- Each life-stage persona gets a DISTINCT theme (palette, typography, illustrations)
- TCM content must be evidence-based — cite sources
- Food knowledge must include BOTH Chinese medicine principles AND Western nutritional science
- All content lives in the Knowledge Hub with persona-filtered views
- Mobile-first (390px viewport)
- Do NOT break existing pages or navigation
- Co-branded: "Ovuluna"

## What We Built

### 1. Life-Stage Persona System
Four profiles, each with their own theme:

| Persona | Age Range | Theme Direction | Palette |
|---|---|---|---|
| 🌸 **Bloom** | Teens 13–17 | Soft, gentle, educational | Blush pink, lilac, mint, coral |
| 🌱 **Grow** | TTC 25–38 | Warm, hopeful, nurturing | Terracotta, sage green, gold, ivory |
| 🌿 **Nurture** | Post-pregnancy | Calm, grounding, restorative | Soft lavender, seafoam, peach, earth tones |
| 🌙 **Wisdom** | Pre & post menopause 40–60 | Elegant, empowered, deep | Warm cocoa, burnished gold, mulberry, deep sage |

Each persona gets:
- Custom palette, typography accents, border radius, shadow depth
- Personalized Knowledge Hub content
- Persona selector in Settings > Appearance
- CSS variables via `data-persona` attribute with 400ms crossfade transition

### 2. TCM Acupoint Atlas (acupoints.html)
- Interactive body map with 13 acupoints highlighted
- Each card: Chinese name + characters, English name, location, TCM function, stimulation methods, evidence badge, life stage tags
- Filter by: Life Stage, Symptom
- "My Routine" — save 3–7 points with timer
- Pregnancy contraindication auto-flagging for SP6 and LI4

### 3. Myofascial Relief Guide (myofascial.html)
- 8 techniques with step-by-step instructions, duration, frequency
- Persona-filtered views
- "Relief Sessions" — guided 5/10/15 min sessions with timer
- Evidence cited (PubMed IDs)

### 4. Food Tracking Expansion (foods.html)
- 22 foods with TCM+Western dual-view database
- Phase-synced eating guide (follicular vs luteal vs menstrual)
- Life-stage filtered food recommendations
- Contraindication warnings system
- TCM thermal nature + flavor + meridian data

### 5. Knowledge Hub Reorganized (learn.html)
- Persona filter chips at top
- 4 life-stage content sections with TCM Wellness + Food Knowledge links
- Existing wiki, videos, articles preserved

## Tech
- Static HTML/CSS/JS (current architecture)
- Vercel for hosting
- CSS custom properties for persona theming (ovuluna-persona.css)
- 8 Google Fonts loaded for persona typography
- LocalStorage for persona persistence
