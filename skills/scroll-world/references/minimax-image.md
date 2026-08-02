# MiniMax Image Stills

Use this path when the scene stills should be rendered with MiniMax `image-01`.
The helper keeps the same asset contract as the rest of the pipeline: one local
PNG per scene prompt, later converted to the `.webp` posters consumed by the page.

## Setup

```bash
export MINIMAX_API_KEY="..."
export MINIMAX_REGION=global_en     # global_en or cn_zh
```

Endpoint selection:

| Region | Endpoint |
|---|---|
| `global_en` | `https://api.minimax.io/v1/image_generation` |
| `cn_zh` | `https://api.minimaxi.com/v1/image_generation` |

The request uses bearer authorization and sends JSON to `/v1/image_generation`.
Required fields are `model` and `prompt`. Supported optional fields in the helper are
`aspect_ratio`, `width`, `height`, `response_format`, `seed`, `n`,
`prompt_optimizer`, and `subject_reference`.

## Batch Stills

Write prompt files to `$WORK/still_<name>.txt`, then run:

```bash
for n in $NAMES; do
  python3 skills/scroll-world/references/minimax_image.py \
    --prompt-file "$WORK/still_$n.txt" \
    --output "$WORK/still_$n.png" \
    --aspect-ratio 3:2 \
    --response-format base64 &
done
wait
```

Use `--response-format url` if you prefer a temporary URL response. MiniMax image URLs
are short-lived, so download them immediately when using URL output.

The helper accepts both documented response shapes for generated images:
`data.image_urls` for URL results and base64 image payloads returned under `data`.
It fails if `base_resp.status_code` is non-zero or if no image is present.
