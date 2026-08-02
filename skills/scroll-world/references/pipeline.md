# Pipeline: copy-paste scripts (bash 3.2 safe)

Set these once. `NAMES` is the ordered section ids; the last is the hero/finale.

```bash
WORK=/tmp/scroll-world           # scratch dir for prompts, sources, frames
ASSETS=./assets                  # where the site reads stills (webp) + clips (mp4)
mkdir -p "$WORK" "$ASSETS/vid"
NAMES="farm kitchen shop delivery plaza finale"   # <-- your section ids, in order

# Chain video model — ONE for every chained clip (SKILL Step 4 roster).
# Must accept --start-image AND --end-image (verify: higgsfield model get <model>):
# seedance_2_0 | kling3_0 | seedance_2_0_mini (draft tier). Reference-only models can't
# hold a seam; models without --mode (e.g. kling3_0_turbo) need their own flag branch below.
# DEFAULT backend: Monid pay-per-clip (§7 — gen_dive_monid/gen_conn_monid with
# VRES=1080p|720p|480p instead of VOPTS). The gen_dive/gen_conn functions in §2/§4
# below are the Higgsfield-credits FALLBACK (and the only home of kling3_0/mini).
# OPT-IN backend: OpenRouter (§8 — gen_*_openrouter) when Step 0.6 / Step 1.7
# selected VIDEO_BACKEND=openrouter — never auto-selected over Monid.
VMODEL=seedance_2_0
case "$VMODEL" in                                  # per-model flags + durations (bash 3.2 safe)
  kling3_0)          VOPTS="--mode std --sound off";          DIVE_DUR=10; CONN_DUR=5 ;;  # no --resolution param on Kling
  seedance_2_0_mini) VOPTS="--mode std --resolution 720p";    DIVE_DUR=8;  CONN_DUR=5 ;;  # cheap frame-locked previz
  *)                 VOPTS="--mode std --resolution 1080p";   DIVE_DUR=8;  CONN_DUR=5 ;;  # seedance_2_0 default
esac
```

Higgsfield generations take minutes — every `higgsfield ... --wait` call below is meant
to run inside a **backgrounded** script. Launch the whole script with your tool's
background/detached mode and poll the progress log; never block the foreground.

## 1. Scene stills (Step 2)

Write one prompt file per section to `$WORK/still_<name>.txt` (see prompts.md), then:

```bash
gen_still() { # name
  higgsfield generate create gpt_image_2 --prompt "$(cat "$WORK/still_$1.txt")" \
    --aspect_ratio 3:2 --resolution 2k --quality high --wait --wait-timeout 15m --json \
    > "$WORK/still_$1.json" 2> "$WORK/still_$1.err"
  url=$(jq -r '.[0].result_url // empty' "$WORK/still_$1.json")
  [ -n "$url" ] && curl -fsSL "$url" -o "$WORK/still_$1.png" && echo "still $1 ok" || echo "still $1 FAIL"
}
for n in $NAMES; do gen_still "$n" & done ; wait
```

Codex variant (STILLS_SOURCE=codex, SKILL Step 1.7 — subscription-billed, zero
credits; ~1–3 min each, parallelize in small batches):

```bash
gen_still_codex() { # name   (< /dev/null is REQUIRED for parallel calls — see SKILL Gotchas)
  codex exec -C "$WORK" -s workspace-write --skip-git-repo-check \
    'Use the image generation tool ($imagegen) to generate: '"$(cat "$WORK/still_$1.txt")"' Wide 3:2 landscape, high resolution. Save it as ./still_'"$1"'.png. Do not do anything else.' \
    > "$WORK/still_$1.codex.log" 2>&1 < /dev/null
  [ -f "$WORK/still_$1.png" ] && echo "still $1 ok (codex)" || echo "still $1 FAIL (see .codex.log)"
}
```

Convert to webp for the site (and optionally run knockout.py first for transparency):

```bash
for n in $NAMES; do cwebp -quiet -q 84 -resize 1800 0 "$WORK/still_$n.png" -o "$ASSETS/$n.webp"; done
```

Review the stills for cohesion before continuing. Re-roll any off-style one (optionally
add `--image "$WORK/still_<good>.png"` to lock style).

## 2. Dive-in clips (Step 4)

Prompt files at `$WORK/dive_<name>.txt`. Start image = the solid-bg still PNG.

```bash
gen_dive() { # name                       ($VOPTS is unquoted on purpose — word-split flags)
  higgsfield generate create "$VMODEL" --prompt "$(cat "$WORK/dive_$1.txt")" \
    --start-image "$WORK/still_$1.png" \
    $VOPTS --aspect_ratio 16:9 --duration "$DIVE_DUR" \
    --wait --wait-timeout 20m --json > "$WORK/dive_$1.json" 2> "$WORK/dive_$1.err"
  url=$(jq -r '.[0].result_url // empty' "$WORK/dive_$1.json")
  [ -n "$url" ] && curl -fsSL "$url" -o "$WORK/dive_$1.mp4" && echo "dive $1 ok" || echo "dive $1 FAIL"
}
for n in $NAMES; do gen_dive "$n" & done ; wait
```

Re-roll individual failures (503 / credit race are transient):
`gen_dive shop`  (just that one).

## 3. Extract boundary frames — the seam handoff (Step 5)

For each adjacent pair, the connector's start = dive_i's LAST frame, end = dive_{i+1}'s
FIRST frame — extracted from the **rendered videos**, never the stills.

```bash
set -- $NAMES
prev=""
for n in "$@"; do
  ffmpeg -v error -ss 0 -i "$WORK/dive_$n.mp4" -frames:v 1 -q:v 2 "$WORK/first_$n.png"      # establishing
  ffmpeg -v error -sseof -0.15 -i "$WORK/dive_$n.mp4" -frames:v 1 -q:v 2 "$WORK/last_$n.png" # interior
done
```

## 4. Connector clips (Step 5)

Prompt files at `$WORK/conn_<i>.txt` (i = 1..N-1). Iterate adjacent pairs:

```bash
gen_conn() { # i startPng endPng          (end-image required → seedance/kling3_0 only)
  higgsfield generate create "$VMODEL" --prompt "$(cat "$WORK/conn_$1.txt")" \
    --start-image "$2" --end-image "$3" \
    $VOPTS --aspect_ratio 16:9 --duration "$CONN_DUR" \
    --wait --wait-timeout 20m --json > "$WORK/conn_$1.json" 2> "$WORK/conn_$1.err"
  url=$(jq -r '.[0].result_url // empty' "$WORK/conn_$1.json")
  [ -n "$url" ] && curl -fsSL "$url" -o "$WORK/conn_$1.mp4" && echo "conn $1 ok" || echo "conn $1 FAIL"
}
set -- $NAMES ; i=0 ; prev=""
for n in "$@"; do
  if [ -n "$prev" ]; then i=$((i+1)); gen_conn "$i" "$WORK/last_$prev.png" "$WORK/first_$n.png" & fi
  prev="$n"
done ; wait
```

## 5. Encode everything for scrubbing (Step 6)

Native resolution (1080p from seedance std; kling3_0 std returned **720p** in testing —
never upscale, encode what ffprobe reports), crf 20, GOP 8, light sharpen, no audio,
faststart. Same for dives + connectors.

```bash
enc() { ffmpeg -v error -y -i "$1" -an -vf "unsharp=5:5:0.8:5:5:0.0" \
  -c:v libx264 -preset slow -crf 20 -pix_fmt yuv420p \
  -g 8 -keyint_min 8 -sc_threshold 0 -movflags +faststart "$2"; echo "enc $2 $(du -h "$2"|cut -f1)"; }

for n in $NAMES; do enc "$WORK/dive_$n.mp4" "$ASSETS/vid/$n.mp4"; done
i=0; for f in "$WORK"/conn_*.mp4; do i=$((i+1)); enc "$f" "$ASSETS/vid/conn$i.mp4"; done
```

Now the engine config's `sections[k].clip = assets/vid/<name>.mp4` and
`connectors = [assets/vid/conn1.mp4, …]` (length N-1, in order).

## 6. Centre-crop mobile encodes — FALLBACK ONLY, not the mobile version

**The mobile version is the native 9:16 portrait chain (§6b).** This section's crop
encodes exist for one case: the user opted into mobile but credits can't cover the
portrait chain — and shipping them must be called out and approved, never silent
(portrait phones will see the landscape film's centre ~26%). The encode mechanics
matter either way: scrubbing sets `currentTime` every frame, and a phone decoder's
**seek cost scales with how many frames it must decode from the nearest keyframe** — so
a 1080p `-g 8` master that scrubs fine on a laptop stutters on a phone. A **smaller
frame + tighter GOP** fixes that (and halves the bytes on cellular). The crop `-m.mp4`
sibling per clip:

```bash
# 720p, GOP 4 (twice the keyframes = ~half the seek-decode work), crf 23, same sharpen/faststart.
encm() { ffmpeg -v error -y -i "$1" -an -vf "scale=-2:720,unsharp=5:5:0.6:5:5:0.0" \
  -c:v libx264 -preset slow -crf 23 -pix_fmt yuv420p \
  -g 4 -keyint_min 4 -sc_threshold 0 -movflags +faststart "$2"; echo "encm $2 $(du -h "$2"|cut -f1)"; }

for n in $NAMES; do encm "$WORK/dive_$n.mp4" "$ASSETS/vid/$n-m.mp4"; done
i=0; for f in "$WORK"/conn_*.mp4; do i=$((i+1)); encm "$f" "$ASSETS/vid/conn$i-m.mp4"; done
```

Wire the variants in the engine config — the engine serves them automatically on phones,
falling back to the desktop `clip` when a mobile one is absent:

```js
sections[k].clipMobile = 'assets/vid/<name>-m.mp4';
connectorsMobile = ['assets/vid/conn1-m.mp4', …];   // length N-1, in order
```

If phone scrubbing still stutters, tighten the GOP further (`-g 2`, or `-g 1` for all-intra
= instant seeks at the cost of larger files); if cellular weight is the bigger worry, raise
`crf` (24–26) or drop to `scale=-2:600`. If the master is already 720p (e.g. kling3_0 std),
the mobile encode still pays off — the tighter GOP is what makes phone seeks cheap. All-mobile encodes stay 16:9 — the engine
centre-crops them; see the portrait note in SKILL Step 8 / prompts.md.

## 6b. Native 9:16 portrait chain — THE mobile version (Step 1.6 opt-in)

When the user opts into mobile, this is what they get: a **parallel 9:16 chain** rendered
natively for phones and shipped as the mobile variants — never the §6 crops (those are the
no-credits stopgap). Same seam laws as the main chain — the portrait chain frame-locks
against its own rendered frames, never the landscape ones. Budget ~2N-1 video gens +
re-rolls (interiors trip the NSFW filter in portrait too); state the credit cost at the
Step 1.6 interview.

1. **Portrait start canvases.** Don't hand the video model a 3:2 still and hope: composite
   each scene onto a 1080×1920 canvas in the page bg colour (island at ~94% width, visual
   centre at ~45% height). The render then opens exactly on what the portrait poster shows.
   For knocked-out stills, composite the RGBA over the bg colour first.
2. **Dives/legs**: same prompt templates with a portrait clause up front ("Vertical
   portrait composition, the diorama centered with generous [bg] space above and below"),
   `--aspect_ratio 9:16`, same model/params as the main chain. Review each last frame
   before chaining, as ever.
3. **Connectors**: extract first/last frames **from the 9:16 renders** and generate 9:16
   connectors between them. A native 9:16 scene mixed into cropped-16:9 neighbours pops at
   both seams — the portrait chain must be complete, not partial.
4. **Encode** with the §6 settings but portrait-oriented scale: `scale=720:-2` (720 wide),
   `-g 4`, crf 23 → these ARE the `-m.mp4` mobile files (and they replace any §6 crop
   stopgaps that shipped earlier).
5. **Posters**: extract each 9:16 dive's first frame → webp → wire as the section's
   `stillMobile` so the poster matches the portrait video's frame 0 (no landscape→portrait
   flash when the clip paints). Engine support: `sections[k].stillMobile`.

## 7. Monid backend — Seedance 2.0 pay-per-clip (the DEFAULT; qualified 2026-07-25)

`bytedance /v1/video/seedance-2.0` via Monid is the roster's `seedance_2_0` billed
per clip in USD, and the **default** chain backend (SKILL Step 4 → Monid backend;
both probes passed) — use these functions in the §2/§4 loops unless the build fell
back to Higgsfield credits. Same chain laws as everywhere else — only the I/O
differs: **frames ride Monid's free `sfs` file
system** (inline base64 is rejected), **`ratio` must be explicit** (the adaptive
default follows the input image's aspect), and runs are fire-and-poll. Token-priced
`w×h×24×sec/1024` at $7/1M (480p/720p), $7.7/1M (1080p) — measured: 1080p ≈ $2.99
dive / $1.87 connector; 720p ≈ $1.21 / $0.76; 480p previz ≈ $0.28 / $0.35.

```bash
# helper: upload a local frame to sfs, print a signed public URL for it ($0).
# NB: /cat and /ls take the SAME relative path you gave /put — not the
# "home/..."-prefixed path /put echoes back (that one 404s).
monid_frame_url() { # localPng remoteName  (JPEG-compresses on the way up)
  jpg="$WORK/sfs_$2.jpg"
  ffmpeg -v error -y -i "$1" -vf "scale='min(1536,iw)':-2" -q:v 2 "$jpg"
  size=$(stat -f%z "$jpg")
  up=$(NO_COLOR=1 monid run -p sfs -e /put \
    -i "{\"path\":\"chain/$2.jpg\",\"sizeBytes\":$size,\"ttl\":\"1h\"}" -w 60 -j \
    | jq -r '.output.uploadUrl')
  curl -fsS -T "$jpg" "$up" > /dev/null
  NO_COLOR=1 monid run -p sfs -e /cat -i "{\"path\":\"chain/$2.jpg\",\"ttl\":\"1d\"}" \
    -w 60 -j | jq -r '.output.url'
}

# fire-and-poll (the CLI's -w caps at 120s and seedance can exceed it)
monid_wait() { # runId outJson
  while :; do
    NO_COLOR=1 monid runs get -r "$1" -j > "$2" 2>/dev/null
    case "$(jq -r '.status // empty' "$2")" in
      COMPLETED|FAILED|BLOCKED|STOPPED|TIME_OUT) break ;;
    esac
    sleep 8
  done
}

gen_dive_monid() { # name   (VRES=1080p|720p|480p; DIVE_DUR as usual)
  furl=$(monid_frame_url "$WORK/still_$1.png" "still_$1")
  jq -n --arg p "$(cat "$WORK/dive_$1.txt")" --arg u "$furl" --arg r "$VRES" \
    '{content:[{type:"text",text:$p},
               {type:"image_url",image_url:{url:$u},role:"first_frame"}],
      resolution:$r, duration:'"$DIVE_DUR"', ratio:"16:9", generate_audio:false}' \
    > "$WORK/dive_$1.body.json"
  rid=$(NO_COLOR=1 monid run -p bytedance -e /v1/video/seedance-2.0 \
    -f "$WORK/dive_$1.body.json" -j | jq -r '.runId')
  monid_wait "$rid" "$WORK/dive_$1.json"
  url=$(jq -r '.output.content.video_url // empty' "$WORK/dive_$1.json")
  [ -n "$url" ] && curl -fsSL "$url" -o "$WORK/dive_$1.mp4" \
    && echo "dive $1 ok (\$$(jq -r '.cost.value' "$WORK/dive_$1.json"))" \
    || echo "dive $1 FAIL ($(jq -r '.status' "$WORK/dive_$1.json"))"
}

gen_conn_monid() { # i startPng endPng
  su=$(monid_frame_url "$2" "conn$1_start"); eu=$(monid_frame_url "$3" "conn$1_end")
  jq -n --arg p "$(cat "$WORK/conn_$1.txt")" --arg s "$su" --arg e "$eu" --arg r "$VRES" \
    '{content:[{type:"text",text:$p},
               {type:"image_url",image_url:{url:$s},role:"first_frame"},
               {type:"image_url",image_url:{url:$e},role:"last_frame"}],
      resolution:$r, duration:'"$CONN_DUR"', ratio:"16:9", generate_audio:false}' \
    > "$WORK/conn_$1.body.json"
  rid=$(NO_COLOR=1 monid run -p bytedance -e /v1/video/seedance-2.0 \
    -f "$WORK/conn_$1.body.json" -j | jq -r '.runId')
  monid_wait "$rid" "$WORK/conn_$1.json"
  url=$(jq -r '.output.content.video_url // empty' "$WORK/conn_$1.json")
  [ -n "$url" ] && curl -fsSL "$url" -o "$WORK/conn_$1.mp4" \
    && echo "conn $1 ok (\$$(jq -r '.cost.value' "$WORK/conn_$1.json"))" \
    || echo "conn $1 FAIL ($(jq -r '.status' "$WORK/conn_$1.json"))"
}
```

Default usage in §2/§4: same loops, `gen_dive_monid`/`gen_conn_monid` in place of
the Higgsfield `gen_dive`/`gen_conn` (mobile chain: `ratio:"9:16"` and the §6b
portrait canvases). Previz: same functions with `VRES=480p`.
Result URLs expire (~24–48 h) — the functions download immediately. Read the billed
`cost.value` per clip (echoed in the ok-line) and `monid balance` between phases; a
`BLOCKED` status is a workspace budget/run cap — terminal, surface it to the user.
Frame extraction, encoding, QA: identical to the Higgsfield path.

**Qualification harness for future/changed endpoints** (each probe = one cheap 480p
clip): (1) prompt + first_frame from a real still → downloaded video's frame 0 must
match the still (eyeball + PSNR ≳ 30 dB) and `cost.value` must match the advertised
cell; (2) add a last_frame from a *different* still → the final frame must land on
that composition (Seedance-style near-miss ok — the crossfade covers it). Known
failure to watch for (it's why the harness exists): `minimax /v1/video_generation`
still silently drops the image when `prompt` is present — image-only output proves
nothing about steerability.

## 8. OpenRouter backend — OPT-IN (qualified 2026-08-02)

Use these functions **only** when the user chose OpenRouter at SKILL Step 1.7
(`VIDEO_BACKEND=openrouter`) after Step 0.6 marked it available. Monid remains
the default (§7). Same chain laws — only the I/O differs: frames ride a **public
S3 bucket** (not Monid `sfs`), requests are async HTTP, and stills can also come
from OpenRouter's Images API.

Requires `OPENROUTER_API_KEY`, `SCROLL_WORLD_S3_BUCKET`, `SCROLL_WORLD_S3_REGION`,
`aws` CLI, `curl`, `jq`, `openssl`. Load env once:

```bash
set -a; . ./.env; set +a   # or wherever OPENROUTER_API_KEY + S3 vars live
RUN_ID=$(date +%Y%m%d-%H%M%S)
VMODEL=bytedance/seedance-2.0
VRES=1080p                 # 480p previz | 720p | 1080p
DIVE_DUR=8; CONN_DUR=5
```

```bash
# helper: upload a local frame to the public bucket, print its public URL.
s3_frame_url() { # localPng remoteName
  jpg="$WORK/s3_$2.jpg"
  ffmpeg -v error -y -i "$1" -vf "scale='min(1536,iw)':-2" -q:v 2 "$jpg"
  key="scroll-world/$RUN_ID/$2.jpg"
  aws s3 cp "$jpg" "s3://$SCROLL_WORLD_S3_BUCKET/$key" --content-type image/jpeg --only-show-errors
  echo "https://$SCROLL_WORLD_S3_BUCKET.s3.$SCROLL_WORLD_S3_REGION.amazonaws.com/$key"
}

# fire-and-poll (OpenRouter video jobs are async)
or_wait() { # jobId outJson
  pollUrl="https://openrouter.ai/api/v1/videos/$1"
  while :; do
    curl -fsS -H "Authorization: Bearer $OPENROUTER_API_KEY" "$pollUrl" > "$2" 2>/dev/null
    case "$(jq -r '.status // empty' "$2")" in
      completed|failed|cancelled|expired) break ;;
    esac
    sleep 15
  done
}

gen_still_openrouter() { # name   (gpt-image-2: no resolution param)
  jq -n --arg p "$(cat "$WORK/still_$1.txt")" \
    '{model:"openai/gpt-image-2", prompt:$p, aspect_ratio:"3:2",
      quality:"high", n:1}' > "$WORK/still_$1.body.json"
  curl -fsS "https://openrouter.ai/api/v1/images" \
    -H "Authorization: Bearer $OPENROUTER_API_KEY" -H "Content-Type: application/json" \
    -d @"$WORK/still_$1.body.json" > "$WORK/still_$1.json" 2> "$WORK/still_$1.err"
  b64=$(jq -r '.data[0].b64_json // empty' "$WORK/still_$1.json")
  if [ -n "$b64" ]; then
    printf '%s' "$b64" | openssl base64 -d -A > "$WORK/still_$1.png"
    echo "still $1 ok (\$$(jq -r '.usage.cost // "?"' "$WORK/still_$1.json"))"
  else
    echo "still $1 FAIL ($(jq -r '.error.message // "see .json/.err"' "$WORK/still_$1.json"))"
  fi
}

gen_dive_openrouter() { # name
  furl=$(s3_frame_url "$WORK/still_$1.png" "still_$1")
  jq -n --arg m "$VMODEL" --arg p "$(cat "$WORK/dive_$1.txt")" --arg u "$furl" --arg r "$VRES" \
    '{model:$m, prompt:$p, duration:'"$DIVE_DUR"', resolution:$r, aspect_ratio:"16:9",
      generate_audio:false,
      frame_images:[{type:"image_url",image_url:{url:$u},frame_type:"first_frame"}]}' \
    > "$WORK/dive_$1.body.json"
  curl -fsS "https://openrouter.ai/api/v1/videos" \
    -H "Authorization: Bearer $OPENROUTER_API_KEY" -H "Content-Type: application/json" \
    -d @"$WORK/dive_$1.body.json" > "$WORK/dive_$1.submit.json" 2> "$WORK/dive_$1.err"
  jobId=$(jq -r '.id // empty' "$WORK/dive_$1.submit.json")
  if [ -z "$jobId" ]; then echo "dive $1 FAIL (submit)"; return; fi
  or_wait "$jobId" "$WORK/dive_$1.json"
  status=$(jq -r '.status' "$WORK/dive_$1.json")
  url=$(jq -r '.unsigned_urls[0] // empty' "$WORK/dive_$1.json")
  if [ "$status" = "completed" ] && [ -n "$url" ]; then
    curl -fsSL -H "Authorization: Bearer $OPENROUTER_API_KEY" "$url" -o "$WORK/dive_$1.mp4"
    echo "dive $1 ok (\$$(jq -r '.usage.cost // "?"' "$WORK/dive_$1.json"))"
  else
    echo "dive $1 FAIL ($status)"
  fi
}

gen_conn_openrouter() { # i startPng endPng
  su=$(s3_frame_url "$2" "conn${1}_start")
  eu=$(s3_frame_url "$3" "conn${1}_end")
  jq -n --arg m "$VMODEL" --arg p "$(cat "$WORK/conn_$1.txt")" --arg s "$su" --arg e "$eu" --arg r "$VRES" \
    '{model:$m, prompt:$p, duration:'"$CONN_DUR"', resolution:$r, aspect_ratio:"16:9",
      generate_audio:false,
      frame_images:[{type:"image_url",image_url:{url:$s},frame_type:"first_frame"},
                     {type:"image_url",image_url:{url:$e},frame_type:"last_frame"}]}' \
    > "$WORK/conn_$1.body.json"
  curl -fsS "https://openrouter.ai/api/v1/videos" \
    -H "Authorization: Bearer $OPENROUTER_API_KEY" -H "Content-Type: application/json" \
    -d @"$WORK/conn_$1.body.json" > "$WORK/conn_$1.submit.json" 2> "$WORK/conn_$1.err"
  jobId=$(jq -r '.id // empty' "$WORK/conn_$1.submit.json")
  if [ -z "$jobId" ]; then echo "conn $1 FAIL (submit)"; return; fi
  or_wait "$jobId" "$WORK/conn_$1.json"
  status=$(jq -r '.status' "$WORK/conn_$1.json")
  url=$(jq -r '.unsigned_urls[0] // empty' "$WORK/conn_$1.json")
  if [ "$status" = "completed" ] && [ -n "$url" ]; then
    curl -fsSL -H "Authorization: Bearer $OPENROUTER_API_KEY" "$url" -o "$WORK/conn_$1.mp4"
    echo "conn $1 ok (\$$(jq -r '.usage.cost // "?"' "$WORK/conn_$1.json"))"
  else
    echo "conn $1 FAIL ($status)"
  fi
}
```

Usage: same loops as §2/§4 with `gen_still_openrouter` / `gen_dive_openrouter` /
`gen_conn_openrouter`. Mobile chain: `aspect_ratio:"9:16"` + §6b portrait canvases.
Previz: `VRES=480p`. Read `usage.cost` per clip. Failed jobs are not billed.
Frame extraction, encoding, QA: identical to the Monid/Higgsfield path.
**No Kling on this path** — NSFW re-rolls that need `kling3_0` finish that one clip
on Higgsfield with the same seam frames (eyeball the join).

**Capability check before offering** (SKILL Step 0.6):

```bash
# must list both first_frame and last_frame
curl -fsS -H "Authorization: Bearer $OPENROUTER_API_KEY" \
  https://openrouter.ai/api/v1/videos/models \
  | jq '.data[] | select(.id=="bytedance/seedance-2.0") | .supported_frame_images'
```

## Notes

- `.[0].result_url` is the field on the `--wait --json` job object. `.min_result_url` is
  a lower-res preview if you ever want it.
- **NSFW fallback across models**: if one clip keeps getting flagged on seedance after
  re-rolls + prompt scrubbing, regenerate just that clip on `kling3_0` with the SAME
  start/end frames: `VMODEL=kling3_0; VOPTS="--mode std --sound off"; gen_conn 3 …` —
  then restore your chain model. See SKILL Gotchas for the trade-off.
- **Previz on the cheap**: run the whole chain once with `VMODEL=seedance_2_0_mini`
  (frame-locking intact, ~720p) to validate the journey and seams before spending
  full-model credits — because it's still seamless, the previz translates directly to the
  final render. Don't reach for reference-only models here: without `--start/--end-image`
  they can't hold a seam, so their output can't be chained (Step 4 rule).
- If a whole batch stalls, check `higgsfield workspace list` for credits and
  `$WORK/*.err` for the reason.
- Concurrency: launching ~5–6 gens at once is fine; much more can trigger transient
  credit/race errors — stagger or re-roll.
