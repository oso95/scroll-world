---
name: scroll-world
description: Build a scroll-scrubbed "fly through the world" landing page where scrolling drives a pre-rendered camera through AI-generated diorama scenes with no visible cuts.
---

# scroll-world

Produces a landing page where **scroll drives a camera**: it dives from outside a scene into its interior, then flies out and into the next scene, continuously, with no visible cuts. The visuals are AI-generated; the page just scrubs pre-rendered video by scroll position. This is the same technique behind Apple's scroll-through product pages.

**What you generate:** N scene stills → N "dive-in" camera clips → N-1 "connector" clips that join consecutive scenes seamlessly → a portable scroll-scrub engine that plays the whole chain as one flight.

**The one rule that makes or breaks it:** seams must be *frame-identical*. Never build a connector from the original artwork; build it from the actual rendered boundary frames of the neighbouring clips.

The repo ships a detailed `skills/scroll-world/SKILL.md` plus `references/` for batch scripts, the engine, prompts, and a knockout helper. Treat this file as the Codex quick-start distilled from the Scroll World Playbook.

---

## 3-piece pipeline

For a world with N scenes (5-7 works best):

1. **N still images** — one per scene. Every prompt reuses the same style preamble word for word. That identical preamble is what makes five images read as one world.
2. **N dive clips** — camera flies in. Image-to-video from each still: starts high and outside, descends inside, the roof or walls gently open. ~8 s each.
3. **N-1 connectors** — the joins. Pull up out of scene i, glide across the world, arrive above scene i+1. ~5 s each. These make it feel connected instead of cut.

---

## The seam rule

A connector never starts from your artwork. It starts from the **actual last frame of the previous clip**, and ends on the **actual first frame of the next**.

Every AI render comes out slightly different. Build a seam from the original still and the join pops on screen. Extract the real boundary frames instead:

```bash
ffmpeg -sseof -0.15 -i dive_i.mp4 -frames:v 1 -q:v 2 dive_i_last.png
ffmpeg -ss 0 -i dive_{i+1}.mp4 -frames:v 1 -q:v 2 dive_next_first.png
# connector: --start-image dive_i_last.png --end-image dive_next_first.png
```

### Two camera architectures — pick by aesthetic

- **A) Continuous forward take** (grounded/photoreal walkthroughs): one camera that only glides forward; each leg starts from the previous leg's real last frame; no connectors at all.
- **B) Dive + aerial connector** (miniature/diorama worlds): the pull-up reads as "zoom out to the map". Never let velocity reverse across a seam — that's the rewind glitch.

---

## Install & requirements

- [Higgsfield CLI](https://higgsfield.ai), authenticated (`higgsfield auth login`), with credits.
- `ffmpeg` / `ffprobe` for frame extraction and encoding.
- Python 3 with Pillow if you want the optional transparent-scene knockout.
- Optional: [Codex CLI](https://github.com/openai/codex) ≥ 0.125. If present, route all N stills through Codex's built-in `image_gen` for zero Higgsfield credits.

For the portable scroll engine and full batch scripts, see `skills/scroll-world/references/` in this repo (`scrub-engine.js`, `index-template.html`, `pipeline.md`, `prompts.md`, `knockout.py`).

---

## Interview before spending anything

1. **Subject** — e.g. "a bubble tea company, from leaf to last sip." A word or a sentence is enough.
2. **Brand kit** — import name, colors and tone from a website URL, hand them over, or propose them. Capture 4-6 named hexes, a display name, and a tone word.
3. **Art direction** — clay diorama (default), papercraft, glossy toy, claymation, neon night, photoreal architectural.
4. **The journey** — 5-7 ordered scenes proposed from the value chain. Each gets an eyebrow, a headline, one body line, and 0-3 tag pills.
5. **Mobile?** A real second film rendered natively in 9:16 portrait — not a crop. Roughly 2× the video credits. Always ask before generating.
6. **Budget** — render tiers shown with estimated credit costs, calibrated against the live balance. Get a go before any render.

---

## Prompt templates

### Style preamble — paste identically into every scene

```
Isometric low-poly 3D diorama floating as a small rounded island on a plain
solid [BG_HEX] background with a soft contact shadow beneath it. Soft matte
clay 3D render, rounded toy-model shapes, gentle warm studio lighting, soft
long shadows, tilt-shift miniature look. Cohesive color palette of [PALETTE].
Highly detailed, centered composition, absolutely no text, no letters,
no numbers, no logos.

Subject: [what is in THIS diorama — the building, a few tiny figures doing
the work, the props that signal this stage of the business].
```

### Dive clip (image-to-video, `--start-image = the still`)

```
Single continuous cinematic camera move, no cuts. Begin high and far, looking
at the whole [scene] from outside. Descend and fly inside toward [focal point].
The roof and walls gently open to reveal the interior. [STYLE], smooth graceful
slow motion. No text.
```

### Connector (`--start-image` + `--end-image` = real boundary frames)

```
Single continuous camera move, no cuts. Pull up and back out of [scene i],
rise into the sky, glide across the connected miniature world, and arrive
above [scene i+1], beginning to descend toward it. Seamless flowing aerial
transition. [STYLE]. No text.
```

---

## Encode for scrubbing

```bash
ffmpeg -i src.mp4 -an -vf "unsharp=5:5:0.8:5:5:0.0" \
  -c:v libx264 -preset slow -crf 20 -pix_fmt yuv420p \
  -g 8 -keyint_min 8 -sc_threshold 0 -movflags +faststart out.mp4
```

- Small GOP (`-g 8`), **not** all-intra.
- Native resolution.
- Strip audio.
- Faststart.

All-intra bloats an 8 s clip to ~25 MB; GOP 8 + blob playback lands around ~8 MB and scrubs fine.

---

## Assemble the page

Use the portable scroll-scrub engine in `skills/scroll-world/references/scrub-engine.js`. It is config-driven, vanilla JS, and drops into plain HTML, Next.js, Vue, or a Python-served page.

Example config shape:

```js
mountScrollWorld(document.getElementById('world'), {
  brand: { name: 'Pearl & Co.' },
  diveScroll: 1.3,
  connScroll: 0.9,
  sections: [
    { id:'farm', label:'The Farms', still:'assets/farm.webp',
      clip:'assets/vid/farm.mp4',
      clipMobile:'assets/vid/farm-m.mp4',
      stillMobile:'assets/farm-m.webp',
      scroll: 1.6, linger: 0.45,
      accent:'#8FB98A', eyebrow:'From leaf to last sip',
      title:'It starts in the hills.',
      body:'...', tags:['Single-origin','Hand-picked'] },
    // ... one per scene
  ],
  connectors: ['assets/vid/conn1.mp4', 'assets/vid/conn2.mp4'],
  connectorsMobile: ['assets/vid/conn1-m.mp4', 'assets/vid/conn2-m.mp4'],
});
```

The engine handles blob-seek, lazy load, seam crossfade, pinned copy, route rail, `prefers-reduced-motion`, and mobile hardening (iOS priming, seek coalescing, safe-area insets).

---

## Honest bill

| Item | Observed cost (Plus plan, Jul 2026) |
|---|---|
| One still (GPT Image 2, 2k) | ~15 credits |
| One video clip (Seedance 2.0 standard, 1080p) | ~40-55 credits |
| 6-scene desktop world (6 stills + 11 clips) | ~530-695 credits |
| Native 9:16 mobile chain | ~2× the video count |
| Re-roll headroom (filter false-positives) | +~15% |

Per-generation pricing isn't exposed by the CLI. Run **one still and one video first**, diff `higgsfield workspace list` before/after, extrapolate, and warn whenever the estimate exceeds ~70% of the balance.

### Two moves that cut the bill

1. **The draft tier.** `seedance_2_0_mini` flies the whole chain at roughly a quarter of the cost and still frame-locks seams. Preview cheap, approve it, then re-render only the final legs on Standard.
2. **The Codex trick.** Already pay for ChatGPT? Route all N stills through Codex's built-in `image_gen` — the same GPT Image 2 model — for zero Higgsfield credits.

---

## Gotchas

| Symptom | Fix |
|---|---|
| Seedance flags an innocent clip as NSFW (bedrooms, pools, spas; words like "bed", "wine", "waterfall") | Re-roll first — it often passes on try 2-3. Then add "empty, unoccupied, no people, architectural, tasteful". Last resort: render that clip on Kling 3.0 with the same start/end frames. |
| Video frozen at frame 0 while scrubbing | Host doesn't serve HTTP byte ranges. Play clips from memory blobs — the bundled engine already does. |
| Seam "pops" between scenes | You built the connector from the diorama still instead of the neighbouring clips' real frames. Redo with extracted boundary frames. |
| Seam "stutters" like a rewind | Camera velocity reversed across the seam. Use architecture A (forward-only take) for grounded walkthroughs. |
| Huge video files (25 MB per 8 s clip) | You encoded all-intra. Use `-g 8` + blob playback: ~8 MB, scrubs fine. |
| Connectors grab the wrong scene's frames on macOS | zsh arrays are 1-indexed. Run every batch loop as a `#!/bin/bash` script, never inline in the interactive shell. |
| Blank scene on iPhone (fine on desktop) | iOS won't paint a seeked frame on a never-played muted video. Keep the still as poster until the clip paints; prime each video on first touch (engine default). |
| Generation fails with 503 or "not enough credits" mid-batch | Usually transient when many jobs launch at once. Re-roll the individual failure; confirm the real balance with `higgsfield workspace list`. |

Scroll is a scrubber — visitors also scroll up. Every camera move must read correctly in reverse, which is one more reason seam velocity can never flip.
