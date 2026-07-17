# fal.ai provider notes

`scroll-world` can run on fal.ai without changing the scrub engine: fal.ai only replaces
the asset-generation layer. The output contract remains the same:

1. scene still PNG/WebP per section
2. dive/leg MP4 per section
3. optional connector MP4s between sections
4. the same encoded assets wired into `scrub-engine.js`

## Requirements

```bash
python3 -m pip install fal-client requests
export FAL_KEY="..."       # fal.ai API key
```

Use `references/fal_pipeline.py` as the thin provider adapter. It uploads local
conditioning frames with `fal_client.upload_file`, submits the job with
`fal_client.subscribe`, writes the raw JSON, and downloads the returned media URL.

## Recommended fal models

The hard requirement for seamless chaining is still **frame locking**:

- every leg/dive model must accept a start image (`image_url` on fal.ai)
- every connector model must also accept an end image (`end_image_url`, or
  `tail_image_url` for models whose schema names it that way)

Confirmed API docs expose the needed fields for:

| Purpose | fal endpoint | Key inputs | Notes |
|---|---|---|---|
| Video default | `fal-ai/bytedance/seedance/v1/pro/image-to-video` | `image_url`, `end_image_url`, `aspect_ratio`, `resolution`, `duration` | Closest fal equivalent to the Higgsfield Seedance path. Supports 1080p and 2–12s durations. |
| Video cheaper/draft | `fal-ai/bytedance/seedance/v1/lite/image-to-video` | `image_url`, `end_image_url`, `aspect_ratio`, `resolution`, `duration` | Good previz candidate; verify seams before final. |
| Video fallback | `fal-ai/kling-video/v2.1/pro/image-to-video` | `image_url`, end image field shown in docs | Use when Seedance fails a clip. Check the current schema; some Kling fal endpoints name the end frame `tail_image_url`. |
| Image stills | `fal-ai/flux-pro/v1.1-ultra` | `prompt`, `aspect_ratio` | Text-to-image fallback for cohesive scene stills. You can swap to another fal image model if its docs support 3:2 or image sizing. |

Before batching a project, open the endpoint docs and confirm field names. fal.ai model
schemas evolve, so prefer `--extra key=value` or `--end-field tail_image_url` over editing
the skill if only a parameter name changed.

## Scene stills

Write one prompt per section to `$WORK/still_<name>.txt` as usual, then:

```bash
FAL_IMAGE_MODEL=${FAL_IMAGE_MODEL:-fal-ai/flux-pro/v1.1-ultra}

fal_still() { # name
  python3 references/fal_pipeline.py image \
    --model "$FAL_IMAGE_MODEL" \
    --prompt-file "$WORK/still_$1.txt" \
    --aspect-ratio 3:2 \
    --out-json "$WORK/still_$1.json" \
    --out-file "$WORK/still_$1.png"
}
for n in $NAMES; do fal_still "$n" & done ; wait
```

Then convert to site WebP exactly like the Higgsfield pipeline:

```bash
for n in $NAMES; do cwebp -quiet -q 84 -resize 1800 0 "$WORK/still_$n.png" -o "$ASSETS/$n.webp"; done
```

## Architecture A — continuous forward take

The only change from the Higgsfield flow is the command. fal's start frame is `--image`
(which becomes `image_url` after upload). Do **not** pass an end frame for architecture A.

```bash
FAL_VIDEO_MODEL=${FAL_VIDEO_MODEL:-fal-ai/bytedance/seedance/v1/pro/image-to-video}

fal_leg() { # index name start_png duration
  python3 references/fal_pipeline.py video \
    --model "$FAL_VIDEO_MODEL" \
    --prompt-file "$WORK/leg_$2.txt" \
    --image "$3" \
    --aspect-ratio 16:9 --resolution 1080p --duration "$4" \
    --out-json "$WORK/leg_$1_$2.json" \
    --out-file "$WORK/leg_$1_$2.mp4"
}

# leg 0 starts from still_0; each next leg starts from the previous leg's actual last frame.
set -- $NAMES
idx=0
start="$WORK/still_$1.png"
for n in "$@"; do
  fal_leg "$idx" "$n" "$start" 8
  ffmpeg -v error -sseof -0.15 -i "$WORK/leg_$idx_$n.mp4" -frames:v 1 -q:v 2 "$WORK/last_$n.png"
  start="$WORK/last_$n.png"
  idx=$((idx+1))
done
```

Wire the generated leg clips as the section clips and leave `connectors: []`.

## Architecture B — dives + connectors

Dives are start-image only and can run concurrently:

```bash
fal_dive() { # name
  python3 references/fal_pipeline.py video \
    --model "$FAL_VIDEO_MODEL" \
    --prompt-file "$WORK/dive_$1.txt" \
    --image "$WORK/still_$1.png" \
    --aspect-ratio 16:9 --resolution 1080p --duration 8 \
    --out-json "$WORK/dive_$1.json" \
    --out-file "$WORK/dive_$1.mp4"
}
for n in $NAMES; do fal_dive "$n" & done ; wait
```

Extract real boundary frames from the rendered dives — never use the stills for connector
endpoints:

```bash
for n in $NAMES; do
  ffmpeg -v error -ss 0 -i "$WORK/dive_$n.mp4" -frames:v 1 -q:v 2 "$WORK/first_$n.png"
  ffmpeg -v error -sseof -0.15 -i "$WORK/dive_$n.mp4" -frames:v 1 -q:v 2 "$WORK/last_$n.png"
done
```

Connectors use both actual boundary frames. If the selected fal endpoint wants
`tail_image_url` instead of `end_image_url`, add `--end-field tail_image_url`.

```bash
fal_conn() { # i start_png end_png
  python3 references/fal_pipeline.py video \
    --model "$FAL_VIDEO_MODEL" \
    --prompt-file "$WORK/conn_$1.txt" \
    --image "$2" --end-image "$3" \
    --aspect-ratio 16:9 --resolution 1080p --duration 5 \
    --out-json "$WORK/conn_$1.json" \
    --out-file "$WORK/conn_$1.mp4"
}

set -- $NAMES ; i=0 ; prev=""
for n in "$@"; do
  if [ -n "$prev" ]; then
    i=$((i+1))
    fal_conn "$i" "$WORK/last_$prev.png" "$WORK/first_$n.png" &
  fi
  prev="$n"
done ; wait
```

## Encode and QA

After fal generation, continue with the existing pipeline's encode, mobile encode, assembly,
and seam QA steps. The browser page does not know or care which provider produced the MP4s.

Important caveats:

- fal.ai returns hosted media URLs; always download them to local project assets before
  encoding so builds are reproducible.
- Do not mix fal and Higgsfield models inside one chain unless you are intentionally
  salvaging one failed clip. Different render character can read as a seam pop even when
  pixels are frame-locked.
- If a fal model's current docs show only reference images and no true start/end frame
  fields, skip it for scroll-world; it cannot preserve seams.
- Keep the raw JSON files. They are useful for PR/debug reports and for confirming the
  seed/model/URL actually used.
