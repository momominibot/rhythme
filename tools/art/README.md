# Art scripts

Room plates, props and sprites are rendered with Seedream through the Volcengine Ark data plane and keyed off
chroma green. `gen.py` reads the key from the `ARK_API_KEY` environment variable (a cloud session's secret) or else
from `~/.config/volcengine/api_key`; nothing is embedded here. A cloud environment also needs `ark.cn-beijing.volces.com`
in its allowed hosts.

- `gen.py "prompt" --out file.png [--size 1024x1024|2K|WxH] [--ref image.png ...] [--model id] [--retries 0]`
  Text to image, or a reference-guided edit with `--ref`. Seedream 5.0 pro (`doubao-seedream-5-0-pro-260628`)
  is the default. Reference edits of the full 1472x1840 room die at about 62 s server side; Seedream 4.0
  (`doubao-seedream-4-0-250828`) at 1328x1664 finishes in about 34 s. 1024x1024 renders never hit the cutoff.
  Put "solid flat pure chroma green background #00FF00" in the prompt for anything that will be keyed.
- `keyout.py in.png out.png --lo 0.12 --hi 0.32 [--largest]`
  Chroma key with despill; `--largest` keeps only the biggest connected shape so stray green specks and
  mint-coloured details (collars, ribbons) do not punch holes. Avoid mint or green in the prompt.

Finished assets go to `assets/room/dream/` as WebP (`cwebp -q 82`), with a `-sm` variant for plates.

Observed limits (18 Oct 2026): Seedream 5.0 pro rejects `--size 768x768` with a BadRequest on `size`, so stay at
1024x1024 or above. Two 1024 PNG renders of the same prompt died with `IncompleteRead` at about 1.35 MB; the same
prompt with `--fmt jpeg` is a far smaller body and is the thing to try next, not a third PNG attempt.

Window skies (18 Oct, evening): never draw a sky by hand into the plate; it reads as pasted. Crop 512 px around
the window from the day plate, ask the model for the same crop with only the view through the window changed
(`gen.py --ref crop.png`, Seedream 4.0 finishes in about 14 s, 5.0 pro dies at 62 s on two of three), then
`window_inpaint.py plate.webp 285 338 painted.jpg room-v3-win-<state>.webp` keeps only the pixels inside the
opening's convex outline (3 px inside the frame, 3 px feather) and prints the percent placement for
`LAYOUTS.room.winPatch`. The frame and the room stay pixel identical; the sky is in the plate's own style.
