---
name: scroll-world
description: >
  Build an immersive scroll-scrubbed "fly through the world" landing page for any
  industry or brand using Higgsfield or fal.ai. As the visitor scrolls, a pre-rendered camera
  flies from outside each scene into its interior, then flows on to the next scene
  with NO cuts — one continuous connected flight (Emons-style isometric diorama world,
  or any art direction you pick). The skill interviews the user for the topic, the
  story beats/sections, and brand kit, then generates cohesive scenes + seamless camera
  clips with Higgsfield/fal.ai and wires a portable, framework-agnostic scroll-scrub engine.
  Use when the user wants a "3D world" / "browse-through-the-industry" hero, a scroll
  cinematic, a diorama landing, or to turn a business into a scrollable world.
allowed-tools: Bash, Read, Write, Edit, AskUserQuestion, Skill
---

# scroll-world

Produces a landing page where **scroll drives a camera**: it dives from outside a scene
into its interior, then flies out and into the next scene, continuously, with no visible
cuts. The visuals are AI-generated (Higgsfield by default, or fal.ai via the adapter in
`references/fal-ai.md`); the page just scrubs pre-rendered video
by scroll position. This is the same technique behind Apple's scroll-through product
pages — the camera genuinely moves, scroll only drives time.

**What you generate:** N scene stills → N "dive-in" camera clips → N-1 "connector" clips
that join consecutive scenes seamlessly → a portable scrub engine that plays the whole
chain as one flight.

**The one rule that makes or breaks it:** seams must be *frame-identical*. Read
[The seamless chain](#step-5--the-seamless-chain-the-critical-part) before generating any
connector. Getting this wrong is the single most common failure and produces a visible
"pop" between scenes.

Do not assume a frontend framework or a generation provider. The scrub engine in `references/scrub-engine.js` is
self-contained vanilla JS (it builds its own DOM + injects its own CSS into a container
you give it), so it drops into plain HTML, Next.js, Vue, a Python-served page, anything.
The value of this skill is the provider pipeline, the prompts, and the seam method —
not the framework. Higgsfield remains the default documented path; fal.ai support is the
same asset contract through a small Python helper.

---

## Step 0 — Bootstrap

1. **Choose a generation provider.** Default to Higgsfield unless the user asks for fal.ai
   or Higgsfield is unavailable. For fal.ai, use `references/fal-ai.md` and
   `references/fal_pipeline.py` (`python3 -m pip install fal-client requests`; `FAL_KEY`
   must be set). The page/engine output is identical either way: local `.webp` stills and
   local encoded `.mp4` clips.
2. **Higgsfield CLI.** If using Higgsfield and `higgsfield` is not on `$PATH`, install per the
   `higgsfield-generate` skill. If `higgsfield workspace list` fails auth, ask the user
   to run `higgsfield auth login` (interactive OAuth — you cannot run it) and, if needed,
   `higgsfield workspace set <id>`. Confirm there are enough credits: a full run is
   roughly `N` image gens + `(2N-1)` video gens.
3. **ffmpeg / ffprobe** on `$PATH` (frame extraction + encoding).
4. **An image tool** for background knockout if you want floating scenes: PIL
   (`python3 -c "import PIL"`), or `cwebp`/`sips`. Optional — see Step 3.
4. **(Optional) Codex CLI** — if `codex` is on `$PATH` (≥ 0.125) and
   `codex login status` reports a ChatGPT login, the scene stills can be generated
   through Codex's built-in `image_gen` (the same gpt-image-2 model) billed to the
   user's ChatGPT subscription instead of Higgsfield credits — offer it at
   Step 1.6, command in Step 2. Absence just removes the option.
5. Caveats: macOS ships **bash 3.2** (no `declare -A`); don't use associative arrays in
   scripts. Higgsfield generations take **3–8 min each** — always run them detached
   (background) and poll, never a foreground blocking call. Reference-by-job-UUID is
   rejected by media flags — pass **local file paths** to `--image/--start-image/--end-image`.
   Video models differ in accepted params (e.g. Kling has no `--resolution`) and in whether
   they support start/end-image conditioning at all — before batching, confirm the chosen
   model's schema with `higgsfield model get <job_type>` and see the Step 4 model table.

---

## Step 1 — Interview the user

The **subject is the user's to state — ask it as an open question in plain prose**, never a
fabricated multiple-choice. A made-up list of industries biases them and reads as you
deciding their business for them; let them answer in their own words (their real business,
a client's, or any idea). Reserve structured multiple-choice (`AskUserQuestion` in Claude
Code; a plain either/or question elsewhere) for the genuinely
enumerable, lower-stakes choices below — art direction and brand-kit approach — and even
there, signal they can go their own way ("Other"). Ask only what you can't sensibly
default. Cover:

1. **Subject** (ask openly, not multiple-choice) — "What should this world be about? Your
   business, a client's, or any idea — a word or a sentence is fine." Capture the
   industry/product + a one-line pitch (e.g. "a bubble tea company, from leaf to last
   sip"), and a brand name if they have one; otherwise you'll propose one below.
2. **Brand kit** — offer three paths, pick one:
   - Import from a URL: `higgsfield marketing-studio brand-kits fetch --url <site> --wait`
     (pulls name, colours, tone). Then read it back with `brand-kits list --json`.
   - The user hands you palette + name + tone directly.
   - You propose a palette + name and let them approve.
   Capture **4–6 named hex values**, a display name, and a tone word or two.
3. **Art direction** — default is "soft matte low-poly **clay diorama**, isometric,
   tilt-shift miniature, warm light." Offer alternatives (flat papercraft, glossy toy,
   claymation, neon night). Whatever is chosen becomes the shared **style preamble**
   reused verbatim in every scene prompt (this is what makes the world cohesive).
4. **The journey (sections)** — the ordered scenes the camera flies through. Propose a
   set derived from the subject's own value chain and let the user edit. 5–7 works well.
   Boba example: farms → pearl kitchen → flagship shop → delivery → community plaza →
   the hero product. Each section needs: a short subject description (what's IN the
   diorama), an eyebrow, a headline, one line of body, and 0–3 tag pills. The last
   section is usually the hero product + the CTA.
5. **Mobile version — ALWAYS ask this; never silently generate both.** Ask as a
   two-option choice (`AskUserQuestion` in Claude Code; a plain question elsewhere):
   *"Want a mobile-optimized version too? The mobile version is a second camera chain
   rendered natively in **9:16 portrait** — composed for phones, not a crop of the
   landscape film — which roughly doubles the Higgsfield credit spend (state the
   estimated number)."*
   Options: "Desktop only" / "Desktop + mobile (native 9:16 — ~2× credits)". The
   credit cost must be stated to the user, not just implied.
   What the answer gates:
   - **Yes** → render the parallel 9:16 portrait chain and ship it as the mobile variants
     (Step 6 / pipeline.md §6b): portrait start canvases → 9:16 dives + connectors
     frame-locked against their own renders → 720-wide `-m.mp4` encodes → `stillMobile`
     portrait posters. Wire `clipMobile`/`connectorsMobile`/`stillMobile` (Step 7); run
     the full mobile QA (Step 8). Budget ~2N-1 extra video gens + NSFW re-rolls.
     **Never ship the centre-crop as the mobile version by default** — if credits can't
     cover the portrait chain, say so and offer the crop encodes (pipeline.md §6) as an
     explicitly-labelled stopgap the user must approve.
   - **No** → skip the mobile encodes and wiring entirely. The engine's phone hardening
     (seek-coalescing, iOS priming, safe-area CSS) is always on regardless — that's not
     a "mobile version," it's just the page not breaking when a phone visits — so a
     desktop-only build still degrades gracefully.

6. **Budget — engines shown by cost, decided before anything renders.** Present the
   render tiers (`AskUserQuestion`), then compute and state the estimated total for
   the user's N scenes — `N stills + (2N−1) videos [videos ×2 if mobile] + ~15%
   re-roll headroom` — and get a go before generating.
   - **Video tier** (roster only — every option frame-locks seams, Step 4):

     | Tier | Model | Rough cost |
     |---|---|---|
     | Draft / previz | `seedance_2_0_mini` (720p) | ~¼ of Standard |
     | Standard (default) | `seedance_2_0` (1080p) | baseline |
     | Alternate | `kling3_0` (720p native) | ≈ Standard; different look + content filter |

     Draft doubles as the previz path: run the whole chain cheap, approve the
     journey, re-render final legs on Standard (pipeline.md Notes) — suggest it
     unprompted when the balance reads tight.
   - **Stills source** (only offer if the Codex CLI is present, Step 0.4):
     Higgsfield `gpt_image_2` (spends credits) vs **Codex `image_gen`** — the same
     gpt-image-2 model billed to the ChatGPT subscription (zero credits; counts
     toward Codex usage limits; 1536×1024 output — exactly 3:2, slightly under
     Higgsfield's 2k). Stills are plain PNGs handed to `--start-image`, so the
     video chain is indifferent to their source. Command in Step 2. **One source
     for all N stills of a build** — the two render with slightly different
     character (verified: Codex runs warmer/lighter), and mixing sources across
     scenes reads as style drift, same reason the video chain uses one model.
   - **Calibrate costs, don't guess.** The CLI exposes no pricing and plans differ.
     Run ONE still and ONE video first, diff `higgsfield workspace list` before/
     after, extrapolate to the full run, and warn the user whenever the estimate
     exceeds ~70% of the balance. (Observed on a plus plan, 2026-07: Standard
     video ≈ 40–55 credits, still ≈ 15.) A real `not_enough_credits` mid-run is
     recoverable (finished clips survive; resume after top-up) but ugly — the
     whole point of this step is that the user decides *before* the spend.

If the user names a video model outside the roster, honor it **only if it can
frame-lock seams** (Step 4). This skill only ships seamless output, so a model that
can't frame-lock is declined with a one-line why, not substituted in — use a roster
model instead.

Keep the scroll mechanic fixed (continuous fly-through) — that's the point of the skill.
See `references/prompts.md` for the intake checklist and copy structure.

---

## Step 2 — Generate the scene stills

One image per section, **all sharing the same style preamble** for cohesion. Default
model **`gpt_image_2`** (crisp, great at isometric illustration; returns a solid/white
background which is perfect for floating diorama "islands"). Use `nano_banana_2` only if
the brief is character/cartoon-heavy (note: `nano_banana_2` is a CLI alias — it resolves
to `nano_banana_pro`; it won't appear under that name in `higgsfield model list`).

Prompt shape (full templates in `references/prompts.md`):

```
<STYLE PREAMBLE, identical every time>. On a plain solid <bg> background with a soft
contact shadow. <PALETTE hexes>. No text, no letters, no logos, centered, 3:2.
Subject: <what is in THIS diorama>.
```

- Run all N concurrently, detached. Command per scene:
  `higgsfield generate create gpt_image_2 --prompt "$(cat scene_i.txt)" --aspect_ratio 3:2 --resolution 2k --quality high --wait --wait-timeout 15m --json > scene_i.json 2>scene_i.err`
- Result URL is `.[]0.result_url` in the `--wait --json` output. `curl` it down.
- **Codex stills variant** (if chosen at Step 1.6 — subscription-billed, zero
  credits): same prompt files, same byte-identical preamble, generated by Codex's
  built-in `image_gen`:

  ```bash
  codex exec -C "$WORK" -s workspace-write --skip-git-repo-check \
    'Use the image generation tool ($imagegen) to generate: '"$(cat "$WORK/still_i.txt")"' Wide 3:2 landscape, high resolution. Save it as ./still_i.png. Do not do anything else.'
  ```

  Single-quote the `$imagegen` segment (the shell must not expand it); if editing
  with reference images, the prompt goes BEFORE any `-i` flag (it's variadic).
  ~1–3 min per image; run a few in parallel, not all N at once. Output lands at
  1536×1024 (3:2) — fine for `--start-image` and posters. Everything downstream
  (cohesion review, knockout, dives) is unchanged.
- A generation may fail transiently (HTTP 503) — re-roll that one individually; don't
  restart the batch.
- **Review the stills before continuing.** They must read as one cohesive world (same
  angle, palette, light). If one is off-style, regenerate it, optionally passing an
  approved scene as `--image` to lock style.

For Higgsfield, see `references/pipeline.md` for the exact batch script. For fal.ai, use
`references/fal-ai.md` §Scene stills; the default still endpoint there is
`fal-ai/flux-pro/v1.1-ultra`, but any fal text-to-image model that supports the needed
aspect/image size can be swapped in.

---

## Step 3 — (Optional) Float the scenes

If you want the dioramas to float over an atmospheric background instead of sitting in a
solid box, knock out the flat background to transparency with
`references/knockout.py` (border-connected flood fill — preserves interior colour that
matches the bg, e.g. cream walls). Then encode to webp. If you'd rather keep it simple,
just make the page background the same colour as the scene background and skip this.

These stills double as **video posters and lazy-load fallbacks**, so keep them.

---

## Step 4 — Camera architecture (pick one — this makes or breaks the feel)

How the camera moves *between* scenes is the single biggest quality lever. Two shapes;
pick by aesthetic.

### Video model — pick ONE for the whole chain

**This skill only ships seamless output**, so the only usable models are ones that can
frame-lock a seam: every chained clip must accept `--start-image`, and connectors also
need `--end-image`. That capability — not preference — is the selection rule. Check any
model with `higgsfield model get <job_type>` and **skip anything whose media inputs are
reference-only** (no start/end image): it can only *condition* a generation, not
*continue* a shot, so it physically can't hold a seam. Schemas below were confirmed
against the CLI:

| Model | start/end image | Notes |
|---|---|---|
| `seedance_2_0` (default) | ✓ / ✓ | Full chain (legs + connectors). `--mode std --resolution 1080p`. Its NSFW filter is the touchy one (see Gotchas). |
| `kling3_0` | ✓ / ✓ | Full chain — tested: `--mode std --sound off --duration 5` with start+end images accepted, seams frame-lock cleanly. **No `--resolution` param** (don't pass one; `--mode std` returns **720p native** — encode what ffprobe reports, never upscale). Sound defaults **on** → `--sound off`. `--duration` default 5, try 10 for legs. Different content filter than Seedance — the sanctioned NSFW fallback. |
| `seedance_2_0_mini` | ✓ / ✓ | Cheap draft tier that keeps frame-locking (720p). The previz tier: run the whole chain here first, then re-render final legs on the full model — still seamless, so it translates directly. |

Those three are the roster — all do both architectures. (`kling3_0_turbo` also frame-locks
via `--start-image`, but has no `--end-image`, so it's architecture-A-only and can't make
connectors; it also takes a different flag set — no `--mode`, has `--resolution` — so it
doesn't drop into the pipeline as-is. It's not in the default roster; only reach for it, and
wire it by hand, if architecture A's sequential render time is a proven bottleneck and you've
benchmarked it as actually faster.)


**fal.ai equivalents.** If the provider is fal.ai, keep the same selection rule but map the
inputs to fal field names: start image = `image_url`, connector end image = `end_image_url`
(or `tail_image_url` for endpoints whose current schema uses that name). The documented
fal path in `references/fal-ai.md` uses:

| fal endpoint | start/end image | Notes |
|---|---|---|
| `fal-ai/bytedance/seedance/v1/pro/image-to-video` | ✓ / ✓ | Default fal video path; docs expose `image_url`, `end_image_url`, `aspect_ratio`, `resolution`, `duration`. |
| `fal-ai/bytedance/seedance/v1/lite/image-to-video` | ✓ / ✓ | Draft/previz candidate; verify seams before final. |
| `fal-ai/kling-video/v2.1/pro/image-to-video` | ✓ / schema-dependent end field | Fallback when Seedance fails; check whether the docs require `end_image_url` or `tail_image_url`. |

Before batching fal jobs, confirm the live endpoint schema. If a model only accepts
reference images (no true start/end frame fields), skip it; it cannot preserve seams.


Rules:
- **One model for all chained clips.** Each renderer has its own motion/color/grain
  character; mixing models mid-chain keeps *position* continuity (frames still hand off)
  but the render-character shift reads as a subtle pop. The one sanctioned exception is
  the NSFW fallback for a single stubborn clip (Gotchas) — a slight character shift on
  one 5s connector beats a missing connector.
- Default to `seedance_2_0`; honor a user's stated preference **only if the model
  qualifies** (frame-locking). If it doesn't, say so and use a supported model — never
  ship a non-seamless build to satisfy a model request.
- The Higgsfield pipeline scripts take the model as `$VMODEL` with per-model flags already
  cased out (`references/pipeline.md`). The fal path uses `$FAL_VIDEO_MODEL` and
  `references/fal_pipeline.py` (`references/fal-ai.md`).

### A) Continuous forward take — RECOMMENDED for grounded / realistic / walkthrough
One camera that only ever glides **forward**, first scene through last, as a single take.
Generate the legs **sequentially**: leg 0 from scene-0's still (glide forward into it);
then each leg's `--start-image` = the **previous leg's ACTUAL last frame** (extract with
ffmpeg), prompt *"continue gliding smoothly FORWARD into [scene i], never pulling back"*
(or an expressive mid-leg move under the motion-handoff contract — see **Camera grammar**
below), and **no `--end-image`** — an end-image of a wide establishing shot forces the
camera to pull back, which is the #1 cause of stutter. Extract each leg's last frame to feed the
next. Result: every seam is frame-identical **and** the camera never reverses. There are
**no connectors** (skip Step 5) — the legs ARE the journey. Wire each leg as a section
clip with `connectors: []` and a small `crossfade` (~0.08). Even without an `--end-image`
the legs still arrive at distinct rooms (the prompt steers the content). Cost: strictly
**sequential** (can't parallelize) and slower; interiors trip the NSFW filter, so build in
re-rolls (3 attempts/leg).

### B) Dive-in + aerial connector — only for diorama / miniature / god's-eye worlds
A "dive into each scene" clip + a connector that pulls **up and out** and flies over to the
next scene (Step 5). The pull-out **reverses camera direction at every seam** (forward dive
→ backward pull-out). In a miniature/diorama world that reads as an intentional "zoom out
to the map, fly to the next island"; in a grounded first-person walkthrough it reads as a
jarring **rewind/stutter**. Use B only for the map-like aesthetic. When in doubt, use A.

### Camera grammar — the move should fit the concept (A is NOT "forward only")

"Forward only" is the *seam* rule, not the *leg* rule. The physics of the chain:

- **Position continuity** at a seam comes from the frame handoff (next leg starts from the
  previous leg's actual last frame).
- **Velocity continuity** at a seam means the camera must never *reverse across a seam* —
  that's the rewind stutter.
- **Inside a single leg the camera is free.** One leg is one continuous render — there is
  no seam to break mid-leg, so orbits, crane-ups, lateral tracking, even a push-in that
  eases back out are all safe *within* the clip. Reversals are only fatal *across* seams.

So give each leg an expressive move chosen from the scene's own logic, under a **motion
handoff contract**: every leg **ends by settling into a slow, steady forward drift** toward
the next destination (final ~1 s), and every leg **begins by continuing that same drift**.
Keep both clauses in the prompts verbatim (templates in `references/prompts.md`).

Pick the grammar from the concept:

| Concept / tone | Mid-leg move |
|---|---|
| Product / luxury retail | slow half-orbit around the hero object, then continue past it |
| Real estate / hospitality | steadicam glide through doorways; gentle crane-up in atria |
| Industrial / process / logistics | low lateral track alongside the line, foreground parallax |
| Travel / outdoors / campus | drone-style rise-and-reveal, then a descending swoop |
| Food / craft / detail-driven | push in close to the craft moment, ease back, carry on |
| Playful miniature (arch. B) | dives + aerial hops — the connector IS the grammar |

Honest costs: expressive mid-leg moves raise re-roll odds — the model can end a fancy move
in a state that isn't a clean forward drift. Mitigations: keep the final-second settle
clause verbatim; **eyeball each leg's last frame before chaining the next** (it should look
like a frame from a gentle forward glide — if not, re-roll before wasting the next leg);
budget ~1 extra re-roll per expressive leg. A plain forward glide stays the zero-risk
default — use it for legs where the scene itself is the show.

Two related pacing knobs live in the engine (Step 7): per-section `scroll` (more scroll
distance = longer dwell in that scene) and `linger` (the camera settles mid-scene exactly
while the copy peaks, then picks up speed toward the seam). Prefer expressive motion in the
*clip* and restraint in the *scrub mapping* — they compound.

And remember scroll is a scrubber: visitors can scroll **up**, so every move also plays in
reverse. That's free and expected — no extra work — but it's another reason seam velocity
must be consistent in both directions (a seam that reads fine forward reads as a stutter
backward too if velocity flips).

**For B**, one camera flight per scene: starts high/outside, descends into the interior,
structure opens. Model: the chain model you picked above (default **`seedance_2_0`**),
`--start-image = the scene still`.

- Use the **solid-background still** (not the knocked-out transparent one) as the
  start image, so the video has a full frame.
- Prompt: "Single continuous cinematic camera move, no cuts. Begin high and far looking
  at the whole <scene> from outside … descend and fly inside toward <focal point> … the
  roof/walls gently open to reveal the interior. <style>, smooth graceful slow motion.
  No text." (Template in `references/prompts.md`.)
- Params (seedance): `--mode std --resolution 1080p --aspect_ratio 16:9 --duration 8`.
  For Kling: drop `--resolution` (no such param), add `--sound off`, `--duration 10`.
  Do **not** pass `--generate-audio` (it errors on seedance; audio is wasted anyway —
  you'll mute).
- Run concurrently, detached, then download each `.result_url`. Re-roll individual
  failures. Keep the raw 1080p sources — you need their frames next.

---

## Step 5 — Connectors (architecture B only)

Skip this whole step for architecture **A** — the forward take has no connectors; its legs
already chain seamlessly. This step applies to **B** (diorama/miniature), and note the
reversal caveat from Step 4.

The connector clips are what make the world feel *connected* instead of cut. A connector
flies from the end of scene i out and into the start of scene i+1. **Both of its
endpoints must be the ACTUAL RENDERED FRAMES of the neighbouring clips — never the
original diorama still.**

Why: every Higgsfield generation renders slightly differently. If a connector *ends* on
a fresh render of "the kitchen diorama," but the next dive clip *starts* on its own
different render of that same diorama, the two won't match and you get a pop at the seam.
The fix is to hand off the exact pixels:

```
For each connector between dive_i and dive_{i+1}:
  start-image = the LAST frame extracted from dive_i's rendered video
  end-image   = the FIRST frame extracted from dive_{i+1}'s rendered video
```

Now every seam is frame-identical on *both* sides:
`dive_i.end == connector.start` and `connector.end == dive_{i+1}.start`.

Extract the boundary frames from the rendered dives (not the stills):

```bash
ffmpeg -sseof -0.15 -i dive_i.mp4   -frames:v 1 -q:v 2 dive_i_last.png    # interior of i
ffmpeg -ss 0      -i dive_{i+1}.mp4 -frames:v 1 -q:v 2 dive_next_first.png # establishing of i+1
```

Generate the connector (`--duration 5` is plenty). Connectors need `--end-image`, so the
model must accept it — any roster model does (`seedance_2_0`, `seedance_2_0_mini`,
`kling3_0`):

```bash
higgsfield generate create "$VMODEL" \
  --prompt "$(cat connector_i.txt)" \
  --start-image dive_i_last.png --end-image dive_next_first.png \
  $VOPTS --aspect_ratio 16:9 --duration 5 --wait --json
# seedance: VOPTS="--mode std --resolution 1080p"; kling3_0: VOPTS="--mode std --sound off"
```

Connector prompt: "Single continuous camera move, no cuts. Pull up and back out of
<scene i>, rise into the sky, glide across the connected miniature world, and arrive
above <scene i+1>, beginning to descend toward it. Seamless flowing aerial transition.
<style>. No text." (Template in `references/prompts.md`.)

Insurance: Seedance lands *close* to the end-image but not always pixel-perfect, so the
engine still applies a **short crossfade** (a few frames) at each seam. Frame-matched
endpoints + a small crossfade = no visible cut. Never skip the actual-frame handoff and
rely on the crossfade alone; a big content jump can't be hidden by a crossfade.

---

## Step 6 — Encode for smooth scrubbing

Scrubbing = setting `video.currentTime` from scroll. Two things matter, and they are
often gotten wrong:

1. **Seekability, not keyframe density, is what makes scrubbing work.** Many static
   hosts (and `python -m http.server`) don't serve HTTP byte-range requests, which pins
   `video.seekable` to `[0,0]` and clamps *every* seek to frame 0 — the video looks
   frozen. The robust fix is to **fetch each clip as a `Blob` and play it from an
   in-memory object URL** (blobs are always fully seekable). The engine does this.
   Because of it, you do **not** need all-intra video.
2. **Don't shrink quality to get smooth seeks.** Encode at the **native resolution**
   (1080p from Seedance — don't downscale), `crf ~20`, a **small GOP** (`-g 8`) rather
   than all-intra (all-intra bloats an 8s clip to ~25 MB; GOP 8 is ~8 MB and scrubs
   fine via blob). Strip audio, add faststart, and a light `unsharp` counters video
   softness:

```bash
ffmpeg -i src.mp4 -an -vf "unsharp=5:5:0.8:5:5:0.0" \
  -c:v libx264 -preset slow -crf 20 -pix_fmt yuv420p \
  -g 8 -keyint_min 8 -sc_threshold 0 -movflags +faststart out.mp4
```

Encode all 2N-1 clips (dives + connectors) with the same settings for uniform quality.

**Mobile encodes (only if the user opted in at Step 1.5).** The mobile version is
the **native 9:16 portrait chain** (pipeline.md §6b): portrait renders of every dive and
connector, encoded **720 wide (`scale=720:-2`), `-g 4`** (more keyframes = cheaper seeks —
phone decoders' seek cost scales with GOP length), crf 23 — wired as `clipMobile` /
`connectorsMobile`, with each portrait dive's first frame extracted as the section's
`stillMobile` poster (Step 7). The engine serves them automatically on phones and falls
back to the desktop clip when absent. The 16:9 centre-crop `encm()` encodes
(pipeline.md §6) are a **fallback only** — for when credits can't cover the portrait
chain — and shipping them must be called out to the user, never silent. If the user chose
desktop-only, skip this — the engine still hardens phone scrubbing regardless
(seek-coalescing, iOS priming), so the page degrades gracefully rather than breaking.

---

## Step 7 — Assemble the page

Copy `references/scrub-engine.js` (and, if you want a fully standalone page, the tiny
`references/index-template.html`) into the user's project — or adapt into their
framework. It's config-driven and self-contained:

```js
mountScrollWorld(document.getElementById('world'), {
  brand: { name: 'Pearl & Co.' },
  diveScroll: 1.3, connScroll: 0.9,          // viewport-heights of scroll per clip
  sections: [
    { id:'farm', label:'The Farms', still:'assets/farm.webp',
      clip:'assets/vid/farm.mp4',
      clipMobile:'assets/vid/farm-m.mp4',      // mobile opt-in only: native 9:16 render
      stillMobile:'assets/farm-m.webp',        // its first frame as the portrait poster
      scroll: 1.6, linger: 0.45,   // optional pacing: longer dwell + camera settles mid-scene
      accent:'#8FB98A', eyebrow:'From leaf to last sip', title:'It starts in the hills.',
      body:'…', tags:['Single-origin','Hand-picked'] },
    // …one per section; last may carry a `cta`
  ],
  connectors:       ['assets/vid/conn1.mp4','assets/vid/conn2.mp4',   /* … length = sections-1 */],
  connectorsMobile: ['assets/vid/conn1-m.mp4','assets/vid/conn2-m.mp4' /* … same length; mobile opt-in only */],
});
```

The engine handles: the ordered dive/connector chain, scroll→currentTime with rAF
smoothing, blob loading, lazy prefetch of nearby clips, frame-matched crossfades, pinned
per-section copy (first section greets on landing, last holds its CTA), a route rail,
`prefers-reduced-motion`, and mobile. **Pacing per section:** `scroll` overrides
`diveScroll` for that scene (more scroll = longer dwell) and `linger` (0–1, keep ≤ 0.6)
remaps time so the camera settles mid-scene — exactly while the copy peaks — then speeds
up toward the seam; seam frames are untouched (f(0)=0, f(1)=1). Give the hero and finale
scenes a higher `scroll` + some `linger`; keep transit scenes brisk. Theme it with CSS variables (`--accent`,
`--sw-bg`, `--sw-ink`, …) — the visual identity comes from the generated clips, so the
chrome stays quiet. See the header of `scrub-engine.js` for the full config + CSS vars.

**On phones the engine adapts automatically** (coarse pointer or ≤860px): it serves
`clipMobile` / `connectorsMobile` when present, **coalesces seeks** (never queues a new
`currentTime` while the decoder is still seeking — this is what stops a fast flick from
freezing the clip), **keeps the still as a poster until the clip paints its first frame**
and **primes each video on first touch** (fixes iOS's blank-until-played video), drops the
drifting particles, ignores URL-bar-only resizes (no scroll jump), and uses safe-area
insets so copy clears the notch/home indicator. All of this hardening is on by default —
no config needed. The `clipMobile`/`connectorsMobile` encodes are the opt-in part
(Step 1.5): only wire them when the user asked for the mobile version.

For non-JS backends (Python/Rails/etc.): serve the assets and drop the engine `<script>`
into the rendered HTML; nothing about it is framework-specific.

---

## Step 8 — QA the seams (don't skip)

Drive the page in a headless browser and **verify frame continuity at the seams**, which
is the thing most likely to be wrong:

- Screenshot at scroll positions just before and just after each seam. The two frames
  must be near-identical (the dive's last frame == the connector's first frame). If they
  pop, you used the diorama still instead of the actual rendered frame (redo Step 5), or
  the crossfade band is too short.
- Check the console for errors, confirm `video.seekable.end(0) > 0` (blob working), and
  that `currentTime` tracks scroll across each clip's band.
- **Mobile — full checklist only if the user opted into the mobile version (Step 1.5).**
  For a desktop-only build, just sanity-check a phone viewport once: page loads, still
  posters show, nothing overlaps — the engine's hardening covers graceful degradation.
  For the mobile build (do this on a real phone or an emulated one, portrait + landscape):
  - Emulate a phone viewport **with CPU throttled 4–6×** and scroll fast — the clip should
    track without freezing (the seek-coalescing + `-m.mp4` encodes are what make this hold).
  - Confirm the first scene shows immediately (its still is the poster) and the video takes
    over the instant you scroll — no blank/black scene (the iOS priming fix). Test iOS Safari
    specifically; it's the one that goes blank if this regresses.
  - Verify the `-m.mp4` variant is actually served on mobile (Network panel), and the
    heavy 1080p master on desktop. The mobile clips must be **natively portrait**
    (`videoWidth < videoHeight` — not a downscaled 16:9 file), and the `stillMobile`
    posters must be served and match each portrait clip's first frame (no
    landscape→portrait flash when the video paints).
  - Slowly scroll so the URL bar collapses — the page must **not jump** (height-only resizes
    are ignored on touch). Rotate the device — layout should recompose cleanly.
  - Only if the crop **fallback** shipped (no credits for the portrait chain): portrait
    crops a 16:9 clip to its centre — confirm the focal subject still reads, and remind
    the user this is the stopgap, not the mobile version.
- Check reduced-motion (should fall back to the stills, no video, no particles).

---

## Gotchas (hard-won)

- **Seam pop** → connector endpoints were the diorama stills, not the neighbouring
  clips' actual frames. Always extract real frames (Step 5).
- **Seam stutter / camera "jumps backward"** → even with frame-matched seams, if the
  camera *velocity reverses* (forward dive, then a connector that pulls back out) it
  reads as a rewind. This is inherent to architecture B. For any grounded walkthrough use
  architecture A (one continuous forward take — legs chained from actual last frames, no
  pull-back, no `--end-image`); see Step 4.
- **Frozen video / stuck at frame 0** → `seekable=[0,0]`; the host isn't serving byte
  ranges. Use blob URLs (engine does).
- **Huge files** → you used all-intra. Use `-g 8` + blob instead.
- **Soft / low quality** → you downscaled or over-compressed. Encode native 1080p,
  crf ≤ 20, add `unsharp`. Video is inherently softer than the stills — keep the stills
  as the lite fallback for max fidelity.
- **Concurrent gens 503 / "not_enough_credits" race** → transient when many launch at
  once; re-roll the individual failure, it's not really out of credits (verify with
  `higgsfield workspace list`).
- **NSFW false-positives (Seedance `status "nsfw"`)** → the video content filter flags
  perfectly innocuous clips, especially **bedroom, pool, spa/wellness** contexts and
  trigger words like "bed", "pool", "waterfall", "wine", "swim". It's partly the prompt
  wording and partly the reference frames. Fixes, in order: (1) re-roll — it's often
  non-deterministic and passes on the 2nd–3rd try; (2) strip trigger words and add
  "empty, unoccupied, no people, no figures, architectural, tasteful"; (3) regenerate
  just that clip on **`kling3_0`** with the same start/end frames — a different
  provider's filter often passes what Seedance blocks. Expect a slight render-character
  shift on that one clip (each model has its own grain/motion feel); for a 5s connector
  behind a crossfade that usually beats option (4): set the connector slot to `null` —
  the engine crossfades that seam directly (optional connectors), so the page still
  completes. Budget extra credits/time for these re-rolls on interiors/real-estate content.
- **Dark / custom theme** → the engine wraps its default tokens in `@layer sw`, so a
  page-level `:root` / `.sw-root { --sw-bg; --sw-ink; --sw-accent; --sw-font-* }` block
  wins cleanly (no specificity hacks). `--sw-ink` is your primary **text/heading** colour;
  the **accent** fills the primary button and active nav. For a dark theme, set `--sw-bg`
  dark and `--sw-ink` light — the copy scrim and title shadow follow `--sw-bg` automatically.
- **Phone scrub stutters / freezes on a fast flick** → the 1080p master is too heavy for a
  phone decoder and seeks pile up. Ship the `-m.mp4` mobile encodes (720p, `-g 4`) and wire
  `clipMobile`/`connectorsMobile` (Step 6/7). The engine already coalesces seeks; the lighter
  encode is the other half. Still choppy on a low-end device? Tighten GOP (`-g 2` / all-intra).
- **Blank / black scene on iOS (desktop was fine)** → an iOS Safari quirk: a muted video that
  was never played won't paint a seeked frame. The engine fixes this by keeping the still as a
  poster until the clip paints and priming each video on first touch — so **don't** hide the
  still on `loadedmetadata` or strip the `playsinline`/`muted` attributes if you adapt the
  engine into a framework.
- **Page jumps while scrolling on mobile** → something is re-running layout on the URL-bar
  show/hide `resize`. The engine ignores height-only resizes on touch; if you ported it, gate
  your resize handler on a width change (keep the `orientationchange` path for rotation).
- **Copy hidden behind the URL bar / notch on mobile** → use the engine's safe-area-aware
  bottom offset (`env(safe-area-inset-bottom)` + `dvh`); make sure the page's
  `<meta viewport>` includes `viewport-fit=cover` (the template does).
- **Portrait crops the scene** → a 16:9 clip on a tall phone shows only its centre — which
  is why the mobile version is the native 9:16 chain (§6b), never the crop. If you're seeing
  this on a mobile build, either the crop fallback shipped (call it out to the user) or the
  9:16 encodes aren't actually being served (check `videoWidth < videoHeight`). Keeping each
  scene's focal subject centred (prompts.md) still matters for the desktop film itself.
- **`--generate-audio` errors on seedance** → omit it; mute in HTML and `-an` on encode.
- **Kling rejects your flags** → `kling3_0` has **no `--resolution` param** (don't pass
  one; encode at whatever native res ffprobe reports) and **sound defaults on** — pass
  `--sound off`. Duration default is 5; legs/dives want 10.
- **Seam pop only where you "saved credits"** → you swapped models mid-chain, or used a
  start-image-only model where a connector needs an `--end-image`. One model for the whole
  chain; the only cheap tier is `seedance_2_0_mini`, which keeps frame-locking so it stays
  seamless. (Any model with reference-only inputs can't hold a seam at all — Step 4.)
- **White-box scenes** → `gpt_image_2` returns a solid bg; either match the page bg to it
  or knock it out (Step 3).
- **bash 3.2** on macOS → no associative arrays in scripts.
- **Connector grabs the wrong scene's frames** (or errors on a frame that doesn't exist
  yet) → the array loop ran in **zsh** (macOS default interactive shell), where arrays are
  1-indexed, not bash's 0-indexed. Keep every array-driven chain step in a `#!/bin/bash`
  script run via `bash script.sh` — never inline array loops in the interactive shell.

## References

- `references/prompts.md` — the intake checklist, style-preamble pattern, and every
  prompt template (scene still, dive, connector) with fill-in slots.
- `references/pipeline.md` — copy-paste batch scripts for the whole run (generate →
  extract frames → connectors → encode → mobile encode), bash-3.2-safe.
- `references/fal-ai.md` — fal.ai provider notes and copy-paste commands for stills,
  architecture-A legs, and architecture-B dives/connectors.
- `references/fal_pipeline.py` — small Python adapter around `fal-client` (upload local
  frames, submit fal jobs, save JSON, download media).
- `references/scrub-engine.js` — the portable, config-driven scrub engine (builds DOM +
  injects CSS; blob-seek, lazy load, seam crossfade, copy, route rail, reduced-motion, and
  phone hardening: mobile encodes, seek-coalescing, iOS priming, safe-area, no-jump resize).
- `references/index-template.html` — a minimal standalone page that mounts the engine.
- `references/knockout.py` — border-connected background knockout for floating scenes.
