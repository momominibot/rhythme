# Music credits

Jamie asked on 23 Oct 2026 for livelier background music, a different melody in each scene, with no copyright to
worry about. Six scenes play a recorded track from OpenGameArt; every source page was checked on 23 Oct 2026 and
lists CC0 as its only licence (public domain dedication: no permission, payment or credit needed; credited anyway).

| Scene (theme) | Track | Author | Source | Licence |
|---|---|---|---|---|
| Home, the houses | Apple Cider | Zane Little Music | https://opengameart.org/content/apple-cider | CC0 |
| Garden, greenhouse | Quaint Town (loopable) | neonarkade | https://opengameart.org/content/quaint-town | CC0 |
| Farm, barn | Joy Ride | Pro Sensory | https://opengameart.org/content/joy-ride | CC0 |
| Dream Street | Bossa Town | KarateStudios | https://opengameart.org/content/bossa-town | CC0 |
| Plaza | Hot Springs Town | Kistol | https://opengameart.org/content/hot-springs-town | CC0 |
| Harbour | Seaside Village | KarateStudios | https://opengameart.org/content/seaside-village | CC0 |

The secret spring keeps the drone drawn in the browser (ovu-music.js caveEvents).

Files in `assets/music/` were made from the lossless downloads: gain to about -23 LUFS integrated, a limiter at
0.89, 30 ms fades at each end against clicks on the loop, 44.1 kHz stereo MP3 at 96 kbit/s (`<theme>.mp3`; MP3 plays
in every browser, and the service worker keeps it for offline like the other media). The
music engine plays them through two reusable players wired into the sound kit's graph, so the Music switch, the
duck under Erin's voice, and the silences for sleep, activities and a hidden page work as before.
