# Pipeline: one-candidate media workflow

## Contents

1. Scene concepts and approval
2. Architecture A legs or architecture B dives
3. Exact boundary-frame extraction
4. Architecture B connectors
5. Approved-only delivery encoding and posters
6. Explicit crop fallback
7. Native portrait chain

The executable examples below are Bash 3.2-safe and use `jq` and `curl`. On Windows, do
not paste them into PowerShell or bounce paths/cleanup between shells. Translate the same
single-candidate functions into PowerShell 7 using:

- `& higgsfield ...` for the CLI call.
- `ConvertFrom-Json` for job output.
- `Invoke-WebRequest -OutFile` for the approved result URL.
- Native `ffmpeg`/`ffprobe` invocations for deterministic media work.
- A one-candidate `.ps1` launched with
  `Start-Process -WindowStyle Hidden -PassThru -RedirectStandardOutput ...`
  `-RedirectStandardError ...` when detached execution is needed.

Preserve revisioned filenames, exact manifest inputs, the approval stops, and every encoder
parameter. First audit which native route exists; report a missing shell/helper rather than
installing it or silently switching environments.

Set these once. `NAMES` is the ordered section ids; the last is the hero/finale.

```bash
WORK=/tmp/scroll-world           # scratch dir for prompts, sources, frames
ASSETS=./wwwroot/assets/scroll-world # adapt to the Blazor static-web-assets project
mkdir -p "$WORK" "$ASSETS/stills" "$ASSETS/video"
NAMES="farm kitchen shop delivery plaza finale"   # <-- your section ids, in order
STILL_MODEL=gpt_image_2          # or nano_banana_2; use one model for the whole chain
STILL_RESOLUTION=2k              # 1k | 2k | 4k
STILL_QUALITY=high               # GPT Image only: low | medium | high
STILL_ASPECT=3:2                 # floating concept; use 16:9 for full-bleed desktop art

# Chain video model — ONE for every chained clip (SKILL Phase 4 roster).
# Must accept --start-image AND --end-image (verify: higgsfield model get <model>):
# seedance_2_0 | kling3_0 | seedance_2_0_mini (draft tier). Always inspect the live
# schema first. Reference-only models cannot hold a seam.
VMODEL=seedance_2_0
# Approved quality settings. Examples:
#   Seedance production: std + 1080p (default)
#   Seedance premium master: std + 4k
#   Seedance efficient: fast + 720p
#   Mini draft: 720p (no mode parameter)
#   Kling: std/pro/4k mode; ffprobe the actual output and never assume/upscale it.
SEEDANCE_MODE=std
SEEDANCE_RESOLUTION=1080p
SOURCE_BITRATE=standard
KLING_MODE=std

case "$VMODEL" in
  kling3_0)
    VOPTS="--mode $KLING_MODE --sound off"
    DIVE_DUR=10; CONN_DUR=5
    ;;
  seedance_2_0_mini)
    VOPTS="--resolution 720p --bitrate_mode $SOURCE_BITRATE --generate_audio false"
    DIVE_DUR=8; CONN_DUR=5
    ;;
  *)
    VOPTS="--mode $SEEDANCE_MODE --resolution $SEEDANCE_RESOLUTION --bitrate_mode $SOURCE_BITRATE --generate_audio false"
    DIVE_DUR=8; CONN_DUR=5
    ;;
esac
```

Higgsfield generations take minutes. Run only the **single currently authorized candidate**
in a background/detached process and poll it. Never launch an image or video generation
loop. Read `review-workflow.md`: after each candidate finishes, show it and stop for
feedback.

The examples below show the candidate functions directly for readability. In agent work,
launch exactly one function in a detached/background process, record its PID, poll it, and
keep the user updated; do not block silently on `--wait`. On Windows, put the one candidate
call in a `.ps1` and use `Start-Process -WindowStyle Hidden -PassThru`; never revive the
old multi-candidate wrapper pattern.

## 1. Scene stills

Write one prompt file per section to `$WORK/still_<name>.txt` (see prompts.md). Generate
one candidate, show it, and stop:

```bash
gen_still_candidate() { # name revision
  name="$1"; rev="$2"; base="$WORK/desktop-still-$name-$rev"
  if [ "$STILL_MODEL" = "gpt_image_2" ]; then
    image_opts="--resolution $STILL_RESOLUTION --quality $STILL_QUALITY"
  else
    image_opts="--resolution $STILL_RESOLUTION"
  fi
  higgsfield generate create "$STILL_MODEL" --prompt "$(cat "$WORK/still_$name.txt")" \
    --aspect_ratio "$STILL_ASPECT" $image_opts --wait --wait-timeout 15m --json \
    > "$base.json" 2> "$base.err"
  url=$(jq -r '.[0].result_url // empty' "$base.json")
  [ -n "$url" ] && curl -fsSL "$url" -o "$base.png" || return 1
  echo "STOP: present $base.png with prompt/settings/cost; wait for thumbs-up/down."
}

# Example: generate exactly one still candidate, then stop.
gen_still_candidate farm r01
```

When the agent has a direct image-generation tool, use it directly with the same prompt,
aspect and review gate. Save the returned file with the revisioned candidate name. Use the
nested Codex CLI variant below only when no direct tool exists and that CLI is already
installed/authenticated (subscription-billed, zero Higgsfield credits):

```bash
gen_still_codex_candidate() { # name revision
  name="$1"; rev="$2"; base="$WORK/desktop-still-$name-$rev"
  codex exec -C "$WORK" -s workspace-write --skip-git-repo-check \
    'Use the image generation tool ($imagegen) to generate: '"$(cat "$WORK/still_$name.txt")"' Use the approved aspect ratio and high resolution. Save it as ./'"$(basename "$base")"'.png. Do not do anything else.' \
    > "$base.codex.log" 2>&1
  [ -f "$base.png" ] || { echo "still $name $rev FAIL (see .codex.log)"; return 1; }
  echo "STOP: present $base.png with prompt/settings; wait for thumbs-up/down."
}

# Example: generate exactly one still candidate, then stop.
gen_still_codex_candidate farm r01
```

After every still has individual 👍 approval, create and show a contact sheet containing
only those approved files. Wait for a separate cohesion approval before any video
generation. Build an exact approved-concept manifest—never use a wildcard:

```bash
APPROVED_STILLS="$WORK/approved-stills.txt"
# One ledger-derived row per scene, in journey order:
# farm|/tmp/scroll-world/desktop-still-farm-r02.png
```

These are concept/conditioning inputs, not public posters. Public posters come from exact
frame 0 of approved videos in §5, matching the proven homepage and avoiding 3:2→16:9
flashes. Optionally run `knockout.py` on an exact approved floating-island concept only
when a portrait canvas/composite needs transparency. If cohesion review reopens a still,
preserve the former approval, create one revision, and repeat both approvals.

## 2A. Continuous forward legs — architecture A

Each next leg starts from the previous leg's **approved actual final rendered frame**.
Generate one revision only, present it, and wait for explicit approval.

Prompt files live at `$WORK/leg_<name>.txt`.

```bash
gen_leg_candidate() { # name exact-start-image scene-reference-or-empty revision
  name="$1"; start="$2"; reference="$3"; rev="$4"
  base="$WORK/desktop-leg-$name-$rev"
  if [ -n "$reference" ] && [ "$reference" != "$start" ] && [ "$VMODEL" != "kling3_0" ]; then
    higgsfield generate create "$VMODEL" --prompt "$(cat "$WORK/leg_$name.txt")" \
      --start-image "$start" --image "$reference" \
      $VOPTS --aspect_ratio 16:9 --duration "$DIVE_DUR" \
      --wait --wait-timeout 20m --json > "$base.json" 2> "$base.err"
  else
    higgsfield generate create "$VMODEL" --prompt "$(cat "$WORK/leg_$name.txt")" \
      --start-image "$start" $VOPTS --aspect_ratio 16:9 --duration "$DIVE_DUR" \
      --wait --wait-timeout 20m --json > "$base.json" 2> "$base.err"
  fi
  url=$(jq -r '.[0].result_url // empty' "$base.json")
  [ -n "$url" ] || { echo "leg $name $rev FAIL"; return 1; }
  curl -fsSL "$url" -o "$base.mp4" || return 1
  ffmpeg -v error -y -sseof -1 -i "$base.mp4" -vf reverse -frames:v 1 -q:v 2 "$base-last.png"
  echo "STOP: present $base.mp4 and review frames; do not generate another video."
}

# Example: generate exactly one candidate, then stop.
gen_leg_candidate farm "$WORK/desktop-still-farm-r02.png" "" r01
# Later leg: exact previous boundary remains start; approved scene concept is reference only.
# gen_leg_candidate kitchen "$WORK/desktop-leg-farm-r01-last.png" \
#   "$WORK/desktop-still-kitchen-r02.png" r01
```

After 👍 approval, record the exact candidate in the ledger. Its `*-last.png` may then
become the next candidate's start image. After 👎 feedback, preserve it and render only
one incremented revision. Architecture A uses approved legs as section clips and
`connectors: []`. Skip §§2B–4.

## 2B. Dive-in clips — architecture B

Prompt files at `$WORK/dive_<name>.txt`. Start image = the solid-bg still PNG.

```bash
gen_dive() { # name approved-start-image revision ($VOPTS is intentionally word-split)
  name="$1"; start="$2"; rev="$3"; base="$WORK/desktop-dive-$name-$rev"
  higgsfield generate create "$VMODEL" --prompt "$(cat "$WORK/dive_$name.txt")" \
    --start-image "$start" \
    $VOPTS --aspect_ratio 16:9 --duration "$DIVE_DUR" \
    --wait --wait-timeout 20m --json > "$base.json" 2> "$base.err"
  url=$(jq -r '.[0].result_url // empty' "$base.json")
  [ -n "$url" ] && curl -fsSL "$url" -o "$base.mp4" || return 1
  echo "STOP: present $base.mp4; wait for thumbs-up/down before any next video."
}

# Example: generate exactly one candidate, then stop.
gen_dive farm "$WORK/desktop-still-farm-r02.png" r01
```

Approve/revise each dive until locked, then move to the next. Lock the complete approved
dive set before extracting connector frames.

## 3. Extract boundary frames — architecture B seam handoff

For each adjacent pair, the connector's start = dive_i's LAST frame, end = dive_{i+1}'s
FIRST frame — extracted from the **rendered videos**, never the stills.

```bash
# Use the exact approved path from the ledger, never a wildcard/rejected revision.
approved="$WORK/desktop-dive-farm-r02.mp4"
ffmpeg -v error -y -ss 0 -i "$approved" -frames:v 1 -q:v 2 "$WORK/approved-first-farm.png"
ffmpeg -v error -y -sseof -1 -i "$approved" -vf reverse -frames:v 1 -q:v 2 "$WORK/approved-last-farm.png"
```

## 4. Connector clips — architecture B

Prompt files at `$WORK/conn_<i>.txt` (i = 1..N-1). Iterate adjacent pairs:

```bash
gen_conn() { # i startPng endPng revision
  i="$1"; start="$2"; end="$3"; rev="$4"; base="$WORK/desktop-connector-$i-$rev"
  higgsfield generate create "$VMODEL" --prompt "$(cat "$WORK/conn_$i.txt")" \
    --start-image "$2" --end-image "$3" \
    $VOPTS --aspect_ratio 16:9 --duration "$CONN_DUR" \
    --wait --wait-timeout 20m --json > "$base.json" 2> "$base.err"
  url=$(jq -r '.[0].result_url // empty' "$base.json")
  [ -n "$url" ] && curl -fsSL "$url" -o "$base.mp4" || return 1
  echo "STOP: present $base.mp4 with both seam comparisons; wait for approval."
}

# Example: generate exactly one connector candidate, then stop.
gen_conn 01 "$WORK/approved-last-farm.png" "$WORK/approved-first-kitchen.png" r01
```

## 5. Encode approved media and derive exact-frame posters

Retain raw masters. Standard Seedance 1080p and Kling’s measured native output are encoded
without upscaling. A 4K master is normally downscaled to 1920 wide for web delivery while
the raw 4K file is archived. Use CRF 20, GOP 8, light sharpen, no audio, and faststart.

```bash
enc() {
  width=$(ffprobe -v error -select_streams v:0 -show_entries stream=width -of csv=p=0 "$1")
  vf="unsharp=5:5:0.8:5:5:0.0"
  [ "$width" -gt 1920 ] && vf="scale=1920:-2,unsharp=5:5:0.8:5:5:0.0"
  ffmpeg -v error -y -i "$1" -an -vf "$vf" \
  -c:v libx264 -preset slow -crf 20 -pix_fmt yuv420p \
  -g 8 -keyint_min 8 -sc_threshold 0 -movflags +faststart "$2"
  echo "enc $2 $(du -h "$2"|cut -f1)"
}

# Section manifest, in journey order, from exact 👍 ledger rows:
# slot|approved-video-source|delivery-video-destination
APPROVED_SECTIONS="$WORK/approved-desktop-sections.txt"

while IFS='|' read slot source destination; do
  [ -n "$source" ] || continue
  enc "$source" "$destination"

  # Poster = exact frame 0 of the approved clip, never the 3:2 concept still.
  poster="$WORK/approved-poster-$slot.png"
  ffmpeg -v error -y -ss 0 -i "$source" -frames:v 1 -q:v 2 "$poster"
  source_width=$(ffprobe -v error -select_streams v:0 -show_entries stream=width -of csv=p=0 "$poster")
  full_width=$source_width
  [ "$full_width" -gt 1280 ] && full_width=1280
  ffmpeg -v error -y -i "$poster" -vf "scale=$full_width:-2" -c:v libwebp -quality 84 "$ASSETS/stills/$slot.webp"
  [ "$full_width" -ge 960 ] && ffmpeg -v error -y -i "$poster" -vf "scale=960:-2" -c:v libwebp -quality 82 "$ASSETS/stills/$slot-960.webp"
  [ "$full_width" -ge 640 ] && ffmpeg -v error -y -i "$poster" -vf "scale=640:-2" -c:v libwebp -quality 80 "$ASSETS/stills/$slot-640.webp"
done < "$APPROVED_SECTIONS"

# Connectors need delivery encodes but no posters:
# approved-source|delivery-destination
APPROVED_CONNECTORS="$WORK/approved-desktop-connectors.txt"
while IFS='|' read source destination; do
  [ -n "$source" ] && enc "$source" "$destination"
done < "$APPROVED_CONNECTORS"

# First-scene CSS blur-up placeholder, derived from its approved frame-0 poster.
IFS='|' read first first_source first_destination < "$APPROVED_SECTIONS"
ffmpeg -v error -y -ss 0 -i "$first_source" -frames:v 1 \
  -vf "scale=32:-2,gblur=sigma=2" -c:v libwebp -quality 28 \
  "$ASSETS/stills/$first-lqip.webp"
```

Visually compare every public WebP with its approved frame 0 to catch an incorrect source,
aspect change, distortion, or crop.
Use actual generated widths/dimensions in the homepage `<picture>`; omit nonexistent 960/640
candidates rather than upscaling. Now `sections[k].clip` points at the approved delivery
video and `sections[k].still` at its matching frame-0 WebP. Architecture A uses
`connectors: []`; architecture B supplies N−1 connector URLs in order.

## 6. Centre-crop mobile encodes — FALLBACK ONLY, not the mobile version

**The mobile version is the native 9:16 portrait chain (§7).** This section's crop
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

# Deterministic encoding may iterate, but always reads exact approved-ledger manifests.
while IFS='|' read slot source destination; do
  [ -n "$source" ] && encm "$source" "${destination%.mp4}-m.mp4"
done < "$APPROVED_SECTIONS"

while IFS='|' read source destination; do
  [ -n "$source" ] && encm "$source" "${destination%.mp4}-m.mp4"
done < "$APPROVED_CONNECTORS"
```

Wire the variants in the engine config — the engine serves them automatically on phones,
falling back to the desktop `clip` when a mobile one is absent:

```js
sections[k].clipMobile = '/assets/scroll-world/video/<name>-m.mp4';
connectorsMobile = ['/assets/scroll-world/video/connector-01-m.mp4', …];
```

If phone scrubbing still stutters, tighten the GOP further (`-g 2`, or `-g 1` for all-intra
= instant seeks at the cost of larger files); if cellular weight is the bigger worry, raise
`crf` (24–26) or drop to `scale=-2:600`. If the master is already 720p (e.g. kling3_0 std),
the mobile encode still pays off — the tighter GOP is what makes phone seeks cheap. All-mobile encodes stay 16:9 — the engine
centre-crops them; this is an explicitly approved fallback, never the native mobile version.

## 7. Native 9:16 portrait chain — THE mobile version (SKILL Phase 2 opt-in)

When the user opts into mobile, this is what they get: a **separate 9:16 chain** rendered
natively for phones and shipped as the mobile variants — never the §6 crops (those are the
no-credits stopgap). Same seam laws as the main chain — the portrait chain frame-locks
against its own rendered frames, never the landscape ones. Budget ~2N-1 video gens +
re-rolls (interiors trip the NSFW filter in portrait too); state the credit cost at the
mobile-media interview.

1. **Portrait start art.** For a floating island, either generate/approve a native 9:16
   still or composite the approved knocked-out island onto a 1080×1920 canvas in the page
   background (about 94% width; visual centre around 45% height) and review the derivative.
   For full-bleed/photoreal work, generate and approve a separate 9:16 still one candidate
   at a time; never crop the landscape concept and call it native composition.
2. **Dives/legs**: after desktop is fully locked, generate each portrait candidate
   individually and use the same thumbs-up/down gate. Use the same prompt templates with
   a portrait clause up front ("Vertical
   portrait composition, the diorama centered with generous [bg] space above and below"),
   `--aspect_ratio 9:16`, same model/params as the main chain. Review each last frame
   before chaining, as ever.
3. **Connectors**: lock all portrait dives first. Extract first/last frames **from the
   approved 9:16 renders**, then generate and approve each 9:16 connector one at a time.
   A native 9:16 scene mixed into cropped-16:9 neighbours pops at both seams — the portrait
   chain must be complete, not partial.
4. **Encode** with the §6 settings but portrait-oriented scale: `scale=720:-2` (720 wide),
   `-g 4`, crf 23 → these ARE the `-m.mp4` mobile files (and they replace any §6 crop
   stopgaps that shipped earlier).
5. **Posters**: extract exact frame 0 from each approved 9:16 section clip. Generate the
   standard 720-wide `stillMobile`, a 480-wide first-picture source, and a portrait LQIP.
   Wire `sections[k].stillMobile`; add the first portrait sources to the SSR `<picture>`
   so the browser selects them before JavaScript. This prevents a landscape→portrait flash.

## Notes

- `.[0].result_url` is the field on the `--wait --json` job object. `.min_result_url` is
  a lower-res preview if you ever want it.
- **NSFW fallback across models**: if one clip keeps getting flagged on seedance after
  re-rolls + prompt scrubbing, regenerate just that clip on `kling3_0` with the SAME
  start/end frames: `VMODEL=kling3_0; VOPTS="--mode std --sound off"; gen_conn 3 …` —
  then restore your chain model. This preserves positional continuity but can introduce a
  subtle grain/motion-character shift, so review that seam carefully in both directions.
- **Previz on the cheap**: work through the chain one approved candidate at a time with
  `VMODEL=seedance_2_0_mini`
  (frame-locking intact, ~720p) to validate the journey and seams before spending
  full-model credits — because it's still seamless, the previz translates directly to the
  final render. Don't reach for reference-only models here: without `--start/--end-image`
  they can't hold a seam, so their output can't be chained (SKILL Phase 4 rule).
- If an individual job stalls, check `higgsfield workspace list` and that candidate's
  `.err` file.
- Paid video concurrency is intentionally **one**, regardless of account limits. The
  approval gate is part of the deliverable, not a speed optimisation to remove.
