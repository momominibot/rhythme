# Ovumind

Menstrual ovarian optimization, food journaling, and mindfulness in one app.

## What is Ovumind?

Ovumind combines three pillars of women's wellness:

1. **Cycle & Ovarian Health** - Track your cycle, understand your phases, optimize ovarian longevity
2. **Food Journaling** - Log meals, get phase-synced nutrition recommendations, TCM + Western food wisdom
3. **Mindfulness** - Guided meditations, breathing exercises, and wisdom from Erin Lee (Take A Pause)

## Tech Stack

- Static HTML/CSS/JS (mobile-first, 390px viewport)
- LocalStorage for data persistence
- Volcengine TTS with Erin Lee's cloned voice (S_PLWb4DCd2)
- Capacitor for iOS native build
- GitHub Pages hosting

## Getting Started

```bash
# Open the app
open index.html

# Or serve locally
python3 -m http.server 8080
```

## Dream room (homepage)

`room.html` is an illustrated isometric room (Seedream 5.0 pro art) where every object is a labelled button: bed (sleep session), bedside clock (record or backdate sleep), wall calendar (period and symptoms with backdating), diary (food journal), computer (learn), wardrobe (avatar outfits). Data lives in one versioned local event log (`ovu-store.js`); rule-based agents (`ovu-agents.js`) write daily summaries for `journal.html` and a 4-week summary for the Dr shares card. `doctor.html` decrypts a passphrase-protected share entirely in the browser. The earlier Three.js room is kept as `room-3d.html`.

## Features

### Cycle Tracking
- Cycle home, log, trends, and delay prediction
- Phase-based insights and hormone education
- Ovarian age assessment and longevity pathways

### Food Journaling
- 22+ foods with TCM + Western dual-view database
- Phase-synced eating guide (follicular, ovulatory, luteal, menstrual)
- Food scanning and nutrition lookup

### Mindfulness (Erin Lee)
- 20+ articles from Take A Pause
- 19 podcast episodes (5.4 hours)
- Guided meditations with Erin's cloned voice
- Breathing exercises and Pali term glossary

### TCM Wellness
- 13 acupoints with interactive body map
- Myofascial relief techniques
- Herbal and topical remedies
- Foot soak recipes

### Life-Stage Personas
- Bloom (teens 13-17)
- Grow (TTC 25-38)
- Nurture (post-pregnancy)
- Wisdom (pre/post menopause 40-60)

## Voice

Erin Lee's cloned voice is powered by Volcengine TTS:
- Voice ID: S_PLWb4DCd2
- Cluster: volcano_icl
- Speed: 0.85x (calm, mindful pacing)

## Credits

Built on Ovuluna (github.com/momominibot/nemow) with mindfulness content from Erin Lee's Take A Pause.
