Read-only proposal. No files changed.

## What we have

- **19 recordings, episodes 81–99**, totalling **321.1 minutes**, verified with `ffprobe`.
- `data/index.json` contains **23 posts**:
  - **20 marked `everyone`**: all 19 episode posts, plus “Early Bird Now Open: The Wholehearted Woman Retreat”.
  - **3 marked `only_paid`**, containing previews: “How Do You Holiday?”, “Who Are You When Nobody Needs Anything From You?”, and “Join Erin at Impact Week 2026”.
- **Every episode MP3 maps by filename/slug to an `everyone` post.** None maps to those three paid-preview posts.
- These are **saved access flags**, not confirmation of today’s availability. Episode bodies explicitly describe becoming paid archive content after an initial free period.
- The episode `.md`/`.json` bodies are **essays/show notes, not full audio transcripts**. No episode transcript or subtitle files were found. `erin-instagram/transcripts/` contains **18 separate reel transcripts**, plus a combined file; some contain transcription errors.
- `public/knowledge.js` supplies **14 themes, 19 Pali glossary terms, 20 quotes, 12 reflective questions and six practice descriptions**.

## Where it lives in the app

**Extend `openMindfulness()` into the shared Mind hub**, retaining its short breathing sessions and the route to `openEveryday()`.

- **Entry points:** Mind tab, yoga mat, and the forthcoming clay Erin avatar. Keep Everyday mindfulness directly accessible.
- **“Listen with Erin” shelf:** a small clay Erin illustration, “Continue listening”, one suggested episode, and “All episodes”.
- **Episode cards:** title, episode number, duration, plain-English theme, progress, and saved-offline status. Tap a card to open its details; **Play is an explicit action**.
- **Player bottom sheet:** artwork, title, seek bar, elapsed/remaining time, play/pause, ±15 seconds, speed **0.75× / 1× / 1.25× / 1.5×**, and sleep timer **10 / 20 / 30 minutes / end of episode**. Default to 1× and stop at the end.
- **While closed:** playback continues with a compact player above the bottom navigation. Tapping it restores the sheet. Starting a breathing session, Everyday practice or another media source pauses the podcast.
- **Resume:** save episode/version, position and speed locally every few seconds and on pause/page exit. Restore the position after reload, but wait for Play. Navigation to another HTML page stops playback in the first version.
- **Offline:** an explicit “Save offline · approximately 6 MB” action, download progress and “Remove download”. Never download the library automatically.
- **Reading:** show the existing text under **Show notes**. Display **Transcript** only after a genuine, reviewed transcript exists. Use English theme chips first, with tappable Pali explanations.
- **Reflection:** offer a source-matched question from `knowledge.js`, then “Reflect with Luna”. Add a draft-only route: current `openLuna(prefill)` immediately sends its prefill.

“An episode for how you feel today” should use **local, transparent rules**, with the user’s chosen mood taking priority. Optional phase-based starting points:

| Optional phase/context | Theme | Episode |
|---|---|---|
| Menstrual / wanting gentleness | Loving-kindness, mettā | 86: Uncovering a Friendly Heart |
| Follicular / wanting sustainable motivation | Wise effort, viriya | 82: Steady, Sustainable Effort |
| Ovulatory / caring for others | Community wellbeing | 98: My Wellbeing, Our Wellbeing |
| Luteal / feeling reactive | Equanimity, upekkha | 87: The Capacity to Remain Balanced |

These are **editorial suggestions, not validated phase-specific prescriptions**. Offer “Choose something else”; use mood-only selection when phase is unavailable or predictions are suspended.

Keep the room’s pastel styling, readable text and restrained animation. No autoplay, including between episodes. The older player in `mindfulness-avatar/public/index.html` currently autoplays the next episode, so do not copy that behaviour.

## Hearts and logging

**Podcast playback should earn no automatic hearts in the first version.** Listening progress and mindfulness practice are different records.

- Store listening history separately from `S.add('mindfulness', …)`. Do not call `afterSave()` on pause, sheet close or `ended`, because it calls `RW.award()`.
- Offer a deliberate **“Practise for two minutes”** or an existing Everyday activity after listening. Save mindfulness minutes only after the user confirms they actually practised, following the honesty pattern in `askPracticeDone()`.
- If rewardable mindful listening is added later, make it an explicit practice mode. Eligible time must exclude seeking, buffering, pauses, muted playback and concurrent sessions; cap it by actual elapsed time so faster playback cannot multiply minutes.
- Award once per practice ID. Use whole minutes and a **shared daily ceiling of 20 base hearts for formal minute-based practice**, rather than permitting repeated 20-heart claims. Preserve Everyday’s separate rules.
- The current `ovu-rewards.js` cap is **per entry**, and `award()` does not deduplicate event IDs. That needs addressing before introducing another rewardable route.

No browser can prove attention. Keeping ordinary playback unrewarded guarantees that **leaving the audio running alone earns nothing**.

## Hosting and size

| Option | Recommendation |
|---|---|
| Public GitHub Pages repository | Keep code and cleared catalog metadata here. Keep episode binaries and restricted text out of Git history. |
| Supabase Storage | Preferred for recordings licensed for in-app use. Public bucket only for unrestricted distribution; private bucket plus server-authorized signed URLs for restricted access. |
| Substack links | Use for attribution and anything not cleared for redistribution. Open the canonical post; do not depend on scraped media URLs. |

Supabase documents both public access and private delivery through signed URLs or authenticated requests. A signed URL needs an actual entitlement check before issuance. [Storage documentation](https://supabase.com/docs/guides/storage/serving/downloads)

**Measured originals:** 235.4 MB, or 224.5 MiB. Eighteen files are mono 96 kbps; `when-persistence-stops-working.mp3` is stereo 128 kbps.

Recommend **48 kbps mono MP3 at 24 kHz**, subject to listening checks with Erin:

```bash
ffmpeg -nostdin -n -i "input.mp3" \
  -map 0:a:0 -vn -ac 1 -ar 24000 \
  -c:a libmp3lame -b:a 48k "output.speech.mp3"
```

This preserves pauses and timing. Estimated whole-library size is **116 MB**, roughly **6.1 MB per average episode**. No re-encoding was performed. [FFmpeg options](https://www.ffmpeg.org/ffmpeg.html)

For `sw.js`:

- Keep code/catalog JSON network-first.
- Add a narrowly scoped Supabase podcast route **before** its current same-origin rejection.
- Cache podcasts only after explicit offline saving, using a complete successful **200 response**. Serve byte ranges correctly for seeking; do not cache streaming **206 fragments** as complete files. Use CORS-enabled audio requests. [Cached-media guidance](https://developer.chrome.com/docs/workbox/serving-cached-audio-and-video)
- Keep downloads in a separate persistent cache. Change activation cleanup: it currently deletes **every cache except `VERSION`**, which would erase downloads on releases.
- Use versioned media paths, quota checks and removable downloads. Initially exclude restricted recordings from offline saving.

At 48 kbps, **1,000 average full-episode listens transfer about 6.1 GB**; 1,000 whole-library downloads transfer about 116 GB, before overhead. Supabase currently lists separate Pro allowances of **250 GB cached and 250 GB uncached egress**, shared with other service usage. Monitor actual consumption. [Egress documentation](https://supabase.com/docs/guides/platform/manage-your-usage/egress)

## Rights and consent

Confirm with Erin, in writing:

- Which exact episodes Rhythme may stream, including recordings now in her paid archive.
- Permission for rehosting, re-encoding, offline copies, show-note reproduction, transcripts, quotations and artwork.
- Commercial scope, duration, withdrawal process and any subscriber restrictions or revenue arrangement.
- Clearance for included third-party poems, translations, music or guest contributions.
- Approval of the clay likeness and any new cloned speech.

The README’s **“scraped with permission”** statement and consent to a voice clone do not establish every distribution permission above.

Credit **“Take A Pause by Erin Lee”**, link every episode to its canonical Substack post, and include [Erin’s publication](https://erinmindfulmoments.substack.com). Clearly distinguish original recordings from the cloned-voice clips and interim scripts already used in `openEveryday()`.

## Build plan

1. **Clear three episodes first**, suggested: 82, 86 and 99. Otherwise provide canonical Substack links.
2. Add `ovumind/assets/data/erin-podcasts.json`, joining the existing podcast index, episode JSON and theme mappings by slug. Suggested shape:

```json
{
  "schemaVersion": 1,
  "episodes": [{
    "id": "tap-99",
    "slug": "the-quiet-work-of-change",
    "number": 99,
    "title": "The Quiet Work of Change",
    "durationSeconds": 970.317,
    "sourceUrl": "https://erinmindfulmoments.substack.com/p/the-quiet-work-of-change",
    "audienceAtCapture": "everyone",
    "themeIds": ["patience"],
    "paliIds": ["khanti"],
    "audioPath": null,
    "audioVersion": null,
    "bytes": null,
    "showNotesPath": null,
    "transcriptPath": null,
    "rightsStatus": "pending",
    "allowOffline": false
  }]
}
```

3. Add **`ovu-podcast.js`** with one persistent audio element, playback state and local resume storage. Add its script and mini-player container to **`room.html`**, outside `#sheetBody`.
4. Change **`room.js`** for the shelf, episode sheet and mutually exclusive audio. Use a distinct sheet ID such as `erin-listen`; closing it must not trigger `stopSession()`.
5. Add styling to **`room.css`**. First useful release: three cleared episodes, streaming, mini-player, resume, speed, sleep timer and show notes.
6. Then change **`sw.js`** for opt-in offline saving; expand to all cleared episodes and add reviewed transcripts and recommendations.
7. Change **`ovu-rewards.js`** only when adding confirmed podcast practice, with idempotency and daily caps. Use **`GUIDES`/`ovu-evidence.js`** for sourced health guidance, keeping episode attribution separate from clinical evidence.

Verify on an actual iPhone: sheet transitions, interrupted playback, reload/resume, lock screen, sleep timer, offline seeking and an app update preserving downloads.

## Risks

- Saved free-access flags can become stale; a public repository makes accidental redistribution difficult to retract.
- Mobile browsers may suspend playback or timers. Background behaviour needs device verification.
- Existing independent audio sources can overlap without coordination.
- Automatic logging would inflate mindfulness totals; existing rewards allow repeated per-entry awards.
- Reel transcripts contain misspelled Pali terms and cannot substitute for episode transcripts.
- Keep mood/phase selection on-device, and avoid presenting Erin’s avatar or Luna as live access to Erin.

