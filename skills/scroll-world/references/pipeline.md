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
VMODEL=seedance_2_0
case "$VMODEL" in                                  # per-model flags + durations (bash 3.2 safe)
  kling3_0)          VOPTS="--mode std --sound off";          DIVE_DUR=10; CONN_DUR=5 ;;  # no --resolution param on Kling
  seedance_2_0_mini) VOPTS="--resolution 720p";                DIVE_DUR=8;  CONN_DUR=5 ;;  # no --mode on mini (catalog: not applicable)
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
    $VOPTS --aspect_ratio 16:9 --duration "$DIVE_DUR" --generate-audio false \
    --wait --wait-timeout 20m --json > "$WORK/dive_$1.json" 2> "$WORK/dive_$1.err"
  url=$(jq -r '.[0].result_url // empty' "$WORK/dive_$1.json")
  [ -n "$url" ] && curl -fsSL "$url" -o "$WORK/dive_$1.mp4" && echo "dive $1 ok" || echo "dive $1 FAIL"
}
for n in $NAMES; do gen_dive "$n" & done ; wait
```

Re-roll individual failures (503 / credit race are transient):
`gen_dive shop`  (just that one).

## 2b. Architecture A — sequential legs (walkthrough / locked-iso)

**Use this instead of §2+§4 when `CAMERA` is walkthrough or locked-iso** (SKILL Step
1.4 → arch A). §2 renders every dive in parallel from its own still, which is
architecture **B**. Architecture A is one continuous take: each leg starts from the
**previous leg's actual last frame**, so the legs *cannot* be parallelized and there
are **no connectors** (skip §4 entirely; wire `connectors: []`).

Prompt files at `$WORK/leg_<name>.txt` (prompts.md → "Leg prompt"). Note there is no
`--end-image` anywhere here — an end-image of a wide establishing shot is what makes
the camera pull back, the #1 cause of seam stutter.

```bash
# Sequential by construction. ~3-8 min per leg, so an N=6 chain is ~30-50 min.
gen_legs() {
  set -- $NAMES
  prev=""; i=0
  for n in "$@"; do
    if [ -z "$prev" ]; then
      START="$WORK/still_$n.png"                 # leg 0 opens on the first scene's still
    else
      # THE seam handoff: the actual last frame of the leg we just rendered.
      ffmpeg -v error -y -sseof -0.15 -i "$WORK/leg_$prev.mp4" -frames:v 1 -q:v 2 "$WORK/legend_$prev.png"
      START="$WORK/legend_$prev.png"
    fi
    tries=0
    while [ $tries -lt 3 ]; do                   # interiors trip the NSFW filter; budget re-rolls
      higgsfield generate create "$VMODEL" --prompt "$(cat "$WORK/leg_$n.txt")" \
        --start-image "$START" \
        $VOPTS --aspect_ratio 16:9 --duration "$DIVE_DUR" --generate-audio false \
        --wait --wait-timeout 20m --json > "$WORK/leg_$n.json" 2> "$WORK/leg_$n.err"
      url=$(jq -r '.[0].result_url // empty' "$WORK/leg_$n.json")
      [ -n "$url" ] && curl -fsSL "$url" -o "$WORK/leg_$n.mp4" && break
      tries=$((tries+1)); echo "leg $n attempt $tries failed ($(jq -r '.[0].status // "?"' "$WORK/leg_$n.json"))"
    done
    [ -f "$WORK/leg_$n.mp4" ] || { echo "leg $n FAILED after 3 tries — stopping (every later leg depends on it)"; return 1; }
    # Eyeball gate: this frame becomes the next leg's start. If it isn't a calm
    # forward glide (or, for locked-iso, if the ANGLE has drifted), re-roll NOW —
    # a bad handoff frame poisons every leg after it.
    echo "leg $n ok — review $WORK/legend_$n.png before continuing"
    prev="$n"; i=$((i+1))
  done
}
gen_legs
```

Encode with §5's `enc()` (`for n in $NAMES; do enc "$WORK/leg_$n.mp4" "$ASSETS/vid/$n.mp4"; done`),
then wire each leg as a section `clip` with `connectors: []` and a small
`crossfade` (~0.08). On Monid/fal, swap the `higgsfield generate create` call for
`gen_dive_monid` / `gen_dive_fal` with `START` as the first frame and no last frame.

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
    $VOPTS --aspect_ratio 16:9 --duration "$CONN_DUR" --generate-audio false \
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
i=1; while [ -f "$WORK/conn_$i.mp4" ]; do enc "$WORK/conn_$i.mp4" "$ASSETS/vid/conn$i.mp4"; i=$((i+1)); done  # index order, not glob order
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
i=1; while [ -f "$WORK/conn_$i.mp4" ]; do encm "$WORK/conn_$i.mp4" "$ASSETS/vid/conn$i-m.mp4"; i=$((i+1)); done
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

   Script below (kept unindented — a `<<'PY'` heredoc terminator must sit at
   column 0, so this block cannot live inside the list indentation).
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

Portrait canvases (step 1) — writes `still_<name>.p.png` at 1080×1920 beside each still:

```bash
cat > "$WORK/portrait_canvas.py" <<'PY'
import sys
from PIL import Image
BG = sys.argv[1]                      # e.g. "#F5EDE0" — the page/scene bg colour
W, H = 1080, 1920
for path in sys.argv[2:]:
    im = Image.open(path).convert("RGBA")
    tw = int(W * 0.94)                # island at ~94% of the canvas width
    im = im.resize((tw, max(1, round(im.height * tw / im.width))), Image.LANCZOS)
    canvas = Image.new("RGB", (W, H), BG)
    # visual centre at ~45% height: slightly high, leaving room for the copy scrim
    canvas.paste(im, ((W - im.width) // 2, round(H * 0.45) - im.height // 2), im)
    out = path.rsplit(".", 1)[0] + ".p.png"
    canvas.save(out); print("portrait", out)
PY
python3 "$WORK/portrait_canvas.py" '#F5EDE0' "$WORK"/still_*.png
```

The `.p.png` canvases are the `--start-image` / `image_url` for every portrait dive.
Set the ratio to `9:16` explicitly too (`--aspect_ratio 9:16`, `FAL_RATIO=9:16`,
Monid `ratio:"9:16"`) — otherwise the adaptive default merely follows the canvas, and
you get portrait by luck rather than by contract.

Posters (step 5):

```bash
for n in $NAMES; do
  ffmpeg -v error -y -ss 0 -i "$WORK/dive_$n.p.mp4" -frames:v 1 -q:v 2 "$WORK/first_$n.p.png"
  cwebp -quiet -q 84 "$WORK/first_$n.p.png" -o "$ASSETS/$n-m.webp"     # -> sections[k].stillMobile
done
```

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
  size=$(wc -c < "$jpg" | tr -d " ")     # portable; stat -f%z is macOS-only, stat -c%s is GNU-only
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

## 8. fal backend — Seedance 2.0 over plain curl (no CLI)

`bytedance/seedance-2.0/image-to-video` is the roster's `seedance_2_0` billed per
clip by fal. Nothing to install: `FAL_KEY`, `curl` and `jq`. Roughly 2× Monid's
price (SKILL Step 1.7 table), bought back with the simplest I/O of any backend and
a **lossless** seam handoff — frames go in as base64 `data:` URIs, so the start
frame is the exact PNG ffmpeg extracted (no rescale, no JPEG round-trip, unlike the
Monid `sfs` path).

Three rules, all of which bite silently: **`aspect_ratio` defaults to `auto`** and
follows the input image, **`generate_audio` defaults to `true`**, and **status/result
URLs drop the `/image-to-video` subpath**.

```bash
: "${FAL_KEY:?set FAL_KEY}"
FAL_MODEL=bytedance/seedance-2.0/image-to-video
FAL_POLL=bytedance/seedance-2.0          # parent path — status/result live here, NOT under the subpath
VRES=1080p                               # 480p previz | 720p | 1080p
FAL_RATIO=16:9                           # 9:16 for the mobile chain (§6b) — never leave it 'auto'

# A local PNG as a base64 data URI. Lossless: the exact bytes ffmpeg wrote.
fal_data_uri() { printf 'data:image/png;base64,%s' "$(base64 -w0 "$1" 2>/dev/null || base64 "$1" | tr -d '\n')"; }

fal_submit() { # bodyJson -> runId
  curl -fsS -X POST "https://queue.fal.run/$FAL_MODEL" \
    -H "Authorization: Key $FAL_KEY" -H "Content-Type: application/json" \
    -d @"$1" | jq -r '.request_id'
}

fal_wait() { # requestId outJson
  while :; do
    st=$(curl -fsS -H "Authorization: Key $FAL_KEY" \
      "https://queue.fal.run/$FAL_POLL/requests/$1/status" | jq -r '.status // "?"')
    case "$st" in
      COMPLETED) curl -fsS -H "Authorization: Key $FAL_KEY" \
                   "https://queue.fal.run/$FAL_POLL/requests/$1" > "$2"; return 0 ;;
      FAILED|CANCELLED|ERROR) echo "fal run $1 -> $st"; return 1 ;;
    esac
    sleep 8
  done
}

gen_dive_fal() { # name          (arch B dive, or an arch-A leg: pass the previous last frame)
  jq -n --arg p "$(cat "$WORK/dive_$1.txt")" --arg img "$(fal_data_uri "$WORK/still_$1.png")" \
        --arg r "$VRES" --arg a "$FAL_RATIO" --argjson d "$DIVE_DUR" \
    '{prompt:$p, image_url:$img, resolution:$r, aspect_ratio:$a,
      duration:($d|tostring), generate_audio:false}' > "$WORK/dive_$1.body.json"
  rid=$(fal_submit "$WORK/dive_$1.body.json") || { echo "dive $1 SUBMIT FAIL"; return 1; }
  fal_wait "$rid" "$WORK/dive_$1.json" || { echo "dive $1 FAIL"; return 1; }
  url=$(jq -r '.video.url // empty' "$WORK/dive_$1.json")
  [ -n "$url" ] && curl -fsSL "$url" -o "$WORK/dive_$1.mp4" && echo "dive $1 ok" || echo "dive $1 FAIL (no video.url)"
}

gen_conn_fal() { # i startPng endPng
  jq -n --arg p "$(cat "$WORK/conn_$1.txt")" \
        --arg s "$(fal_data_uri "$2")" --arg e "$(fal_data_uri "$3")" \
        --arg r "$VRES" --arg a "$FAL_RATIO" --argjson d "$CONN_DUR" \
    '{prompt:$p, image_url:$s, end_image_url:$e, resolution:$r, aspect_ratio:$a,
      duration:($d|tostring), generate_audio:false}' > "$WORK/conn_$1.body.json"
  rid=$(fal_submit "$WORK/conn_$1.body.json") || { echo "conn $1 SUBMIT FAIL"; return 1; }
  fal_wait "$rid" "$WORK/conn_$1.json" || { echo "conn $1 FAIL"; return 1; }
  url=$(jq -r '.video.url // empty' "$WORK/conn_$1.json")
  [ -n "$url" ] && curl -fsSL "$url" -o "$WORK/conn_$1.mp4" && echo "conn $1 ok" || echo "conn $1 FAIL (no video.url)"
}
```

Drop `gen_dive_fal` / `gen_conn_fal` into the §2 / §4 loops (or §2b for arch A).
Stills on fal too, if you want one vendor for the whole build — `fal-ai/gpt-image-2`,
`image_size` as an explicit object so you get exact 3:2:

```bash
gen_still_fal() { # name
  jq -n --arg p "$(cat "$WORK/still_$1.txt")" \
    '{prompt:$p, image_size:{width:2400,height:1600}, quality:"high", output_format:"png"}' \
    > "$WORK/still_$1.body.json"
  rid=$(curl -fsS -X POST "https://queue.fal.run/fal-ai/gpt-image-2" \
    -H "Authorization: Key $FAL_KEY" -H "Content-Type: application/json" \
    -d @"$WORK/still_$1.body.json" | jq -r '.request_id')
  while :; do
    st=$(curl -fsS -H "Authorization: Key $FAL_KEY" "https://queue.fal.run/fal-ai/gpt-image-2/requests/$rid/status" | jq -r '.status // "?"')
    case "$st" in COMPLETED) break ;; FAILED|ERROR|CANCELLED) echo "still $1 FAIL ($st)"; return 1 ;; esac
    sleep 5
  done
  url=$(curl -fsS -H "Authorization: Key $FAL_KEY" "https://queue.fal.run/fal-ai/gpt-image-2/requests/$rid" | jq -r '.images[0].url // empty')
  [ -n "$url" ] && curl -fsSL "$url" -o "$WORK/still_$1.png" && echo "still $1 ok (fal)" || echo "still $1 FAIL"
}
```

Cost: read it off the SKILL Step 1.7 table, or compute it —
`w × h × 24 × sec / 1024` tokens at **$0.014 / 1k tokens**. (That formula reproduces
fal's published $0.3024/s at 720p and $0.682/s at 1080p exactly, so it prices any
duration you like.) fal charges the same whether `generate_audio` is true or false —
pass `false` anyway; you mute it and `-an` it regardless.

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
