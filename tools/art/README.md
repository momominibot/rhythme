# Art scripts

Room plates, props and sprites are rendered with Seedream through the Volcengine Ark data plane and keyed off
chroma green. Both scripts read the key from `~/.config/volcengine/ark_api_key`; nothing is embedded here.

- `gen.py "prompt" --out file.png [--size 1024x1024|2K|WxH] [--ref image.png ...] [--model id] [--retries 0]`
  Text to image, or a reference-guided edit with `--ref`. Seedream 5.0 pro (`doubao-seedream-5-0-pro-260628`)
  is the default. Reference edits of the full 1472x1840 room die at about 62 s server side; Seedream 4.0
  (`doubao-seedream-4-0-250828`) at 1328x1664 finishes in about 34 s. 1024x1024 renders never hit the cutoff.
  Put "solid flat pure chroma green background #00FF00" in the prompt for anything that will be keyed.
- `keyout.py in.png out.png --lo 0.12 --hi 0.32 [--largest]`
  Chroma key with despill; `--largest` keeps only the biggest connected shape so stray green specks and
  mint-coloured details (collars, ribbons) do not punch holes. Avoid mint or green in the prompt.

Finished assets go to `assets/room/dream/` as WebP (`cwebp -q 82`), with a `-sm` variant for plates.
