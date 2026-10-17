# Ovuluna V2 — Animation & Icon Guide

## Strategy: CSS-first, Lottie for complex vectors

The app uses **CSS keyframe animations** for all UI transitions, pulses, and micro-interactions. These are zero-dependency, 0KB extra payload, and GPU-accelerated.

**Lottie JSON** is used only where CSS can't deliver: complex vector morphing, particle systems, and multi-step illustrated sequences. All Lottie files target <15KB each.

## Icons (generated via Higgsfield)

4 persona icons, 1:1 ratio, watercolor + ink outline style:

| Persona | Job ID | Flower Motif | Palette |
|---------|--------|-------------|---------|
| 🌸 Bloom | `66325b71` / `e575002c` | Budding flower | Ballet pink + dusty lilac |
| 🌱 Grow | `6561f4e9` / `1f0c9892` | Blooming flower | Terracotta + sage |
| 🌿 Nurture | `5df01cf0` / `741b36a6` | Soft lavender flower | Lavender + seafoam |
| 🌙 Wisdom | `51f244ec` / `61edb457` | Elegant line flower | Cocoa + mulberry + gold |

### Icon placement:
- `assets/icons/persona-bloom.png` — persona selector, onboarding
- `assets/icons/persona-grow.png` — persona selector, onboarding
- `assets/icons/persona-nurture.png` — persona selector, onboarding
- `assets/icons/persona-wisdom.png` — persona selector, onboarding
- `assets/icons/acupoint-marker.svg` — body map markers (CSS inline SVG)
- `assets/icons/favicon-bloom.png` — dynamic favicon based on active persona

## CSS Animations (animations.css)

| Animation | Use | Duration |
|-----------|-----|----------|
| `acupoint-pulse` | Body map markers | 2s loop |
| `phase-flow` | Cycle phase indicator bar | 4s loop |
| `sparkle-pop` | Milestone celebrations (Bloom) | 1s once |
| `wc-spin` | Watercolor loading spinner | 1s loop |
| `card-rise` | Staggered card enter | 400ms each |
| `breath` | Myofascial breathing guide | 6s loop |
| `fertile-pulse` | Fertile window glow (Grow) | 3s loop |
| `dissolve` | Wisdom content fade-in | 800ms |
| `petal-fall` | Bloom background petals | random |
| `crossfade-wash` | Persona switch transition | 400ms |

## Lottie Files (to create — <15KB each)

| File | Purpose | Persona | Complexity |
|------|---------|---------|------------|
| `persona-bloom.json` | Budding flower unfurls on persona select | Bloom | Simple (1 layer, 2 keyframes) |
| `persona-grow.json` | Flower blooms open | Grow | Simple |
| `persona-nurture.json` | Gentle sway + soft glow pulse | Nurture | Medium |
| `persona-wisdom.json` | Petal drifts + slow dissolve | Wisdom | Medium |
| `acupoint-tap.json` | Ripple rings from tap point | All | Simple |
| `milestone-confetti.json` | Burst of 4-6 particles | Bloom | Medium |
| `loading-brush.json` | Watercolor brush stroke fills circle | All | Simple |

### CDN (no build step):
```html
<script src="https://unpkg.com/@dotlottie/player-component@latest/dist/dotlottie-player.js" defer></script>
```

### Usage:
```html
<dotlottie-player
  src="/assets/lottie/persona-bloom.json"
  autoplay loop
  style="width:48px;height:48px">
</dotlottie-player>
```

### Total payload budget:
- CSS animations: 0KB (in animations.css, ~3KB gzipped)
- 7 Lottie files: ~70KB total
- dotlottie-player: ~45KB (CDN, cached)
- **Total animation payload: ~120KB** vs ~2MB+ for equivalent GIF/MP4

## Performance
- CSS animations run on compositor thread (GPU)
- Lottie renders to canvas/SVG (GPU-friendly)
- No main-thread jank from GIF decoding
- All animations respect `prefers-reduced-motion`
