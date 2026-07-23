# Prompt templates & intake

Everything here is fill-in-the-slots. Keep the **style preamble** byte-for-byte identical
across all scene stills — that identical text is what makes the world feel like one place.

## Contents

1. Intake and locked choices
2. Shared style preamble
3. Scene-image prompts and review
4. Architecture A leg prompts
5. Architecture B dive/connector prompts
6. Homepage copy fields

## Intake checklist (SKILL Phase 2)

Collect and write down:

- `SUBJECT` — the business + one-line pitch.
- `BRAND_NAME` — display name.
- `PALETTE` — 4–6 named hexes, e.g. `taro #9B7EBD, cream #F5EDE0, caramel #C88A5A, matcha #8FB98A, plum #3A2E48`. Pick ONE as the scene **background** colour (usually the lightest) and one as the primary **accent**.
- `TONE` — a word or two (cozy/premium, playful, industrial…).
- `STYLE` — the art direction (default below).
- `SECTIONS[]` — ordered list; for each: `id`, `label`, `subject` (what's in the diorama), `eyebrow`, `title`, `body` (≤ 1 sentence), `tags[]` (0–3). Last section = hero product + CTA.
- `MOBILE` — yes/no. **Always asked** (SKILL Phase 2), presented to the user
  with the ~2× credit cost stated.
- `VIDEO_TIER` — draft Mini 480/720 | efficient Seedance Fast 480/720 |
  production Seedance Standard 1080 (default) | premium Seedance Standard 4K |
  Kling Standard/Pro/4K alternate. Inspect the live schema and show the calibrated
  cost before anything renders.
- `SOURCE_BITRATE` — standard (default) | high. High can improve a demanding master but
  creates a larger source and may affect live pricing; calibrate rather than claiming a
  fixed surcharge. The final web encode is still separately compressed.
- `GENERATE_AUDIO` — no. The site is muted and native audio materially increases cost.
- `STILLS_SOURCE` — Higgsfield `gpt_image_2` 1K/2K/4K (default 2K high) |
  Higgsfield `nano_banana_2`/Nano Banana Pro 1K/2K/4K | Codex `image_gen`
  (no Higgsfield credits; only offer when available). Use one source/model throughout.
- `MOBILE=yes` means the **native 9:16 portrait chain** (pipeline §7):
  portrait renders of every dive/connector + `clipMobile`/`connectorsMobile`/`stillMobile`
  wiring + the full mobile QA. The §6 crop encodes are a no-credits stopgap only.
- `REVISION_ALLOWANCE` — normally 25–50% beyond the accepted-clip base count for
  production, increased for ambitious motion. This is budget headroom, never permission
  to batch: every still and video candidate goes through `review-workflow.md` individually.

## Style preamble (default: clay diorama)

Reuse verbatim in every scene prompt. Swap the bracketed bits for the brand's palette/bg.

```
Isometric low-poly 3D diorama floating as a small rounded island on a plain solid
[BG_HEX] background with a soft contact shadow beneath it. Soft matte clay 3D render,
rounded toy-model shapes, gentle warm studio lighting, soft long shadows, tilt-shift
miniature look. Cohesive color palette of [PALETTE]. Highly detailed, centered
composition, absolutely no text, no letters, no numbers, no logos.
```

Alternate directions (swap the first two sentences, keep the palette/no-text tail):
- **Flat papercraft:** "Isometric layered paper-craft diorama, matte cardstock, clean die-cut edges, subtle drop shadows between layers."
- **Glossy toy:** "Isometric glossy vinyl-toy diorama, smooth plastic shading, soft rim light, collectible figurine look."
- **Claymation:** "Isometric stop-motion clay set, visible thumbprints, handmade plasticine texture, soft studio softbox light."
- **Neon night:** "Isometric miniature at night, warm interior glow and neon signage, moody rim light, wet reflective ground."
- **Photoreal architectural** (real estate, hospitality, premium/luxury): "Ultra-photorealistic architectural photography of a single cohesive [subject], cinematic wide-angle, warm golden-hour light, natural materials, restrained designer furnishings, a breathtaking view, editorial magazine quality (Architectural Digest), shallow depth of field, no people." For photoreal, drop the floating-island framing and the knockout — the scenes are **full-bleed** (a dark page background reads premium), the "dive" glides *through doorways/glass* rather than opening a roof, and cohesion comes entirely from the identical preamble (do NOT pass an `--image` reference — it clones the same room).

## Scene still prompt (SKILL Phase 4)

```
[STYLE PREAMBLE]
Subject: [SECTION.subject — describe the miniature scene: the building/space, a few
characters doing the work, the props that signal this stage of the business].
```

Tips:
- Name concrete props (they anchor the scene): tanks, cauldrons, conveyor, crates, awning, string lights, benches, scooters, map pins.
- For the final "hero product" section, drop the diorama-island framing and prompt a
  single oversized product centerpiece floating on the same background with a few small
  orbiting props.
- **Compose for the centre.** The page renders every clip `object-fit:cover`. Keep the
  focal subject horizontally centred with a little headroom, and don't park anything
  essential at the far left/right edges. Mobile ships its own native 9:16 chain
  (pipeline §7), so this is not about surviving a crop — but a centred composition makes
  the portrait renders open cleanly from the same still, and it keeps the dive's focal
  point where the camera actually flies.
- Use 3:2 for a floating-island concept that may be recomposed; use 16:9 for full-bleed
  desktop art. Native full-bleed mobile uses a separately generated 9:16 composition.
  Default quality remains `--resolution 2k --quality high`.

Generate one still candidate only, present the actual image with prompt/model/dimensions/
quality/cost, and wait for explicit thumbs-up or thumbs-down. Preserve rejected revisions.
Only approved stills may condition video. After every scene still is individually approved,
present an approved-files-only contact sheet and wait for separate cohesion approval before
generating video.

## Leg prompt — architecture A, continuous forward take (SKILL Phase 4)

`--start-image = previous leg's ACTUAL last frame` (leg 0: the first scene's still).
**No `--end-image`.** The bolded clauses are the motion-handoff contract — keep them
verbatim; the mid-leg move is where the expression goes.

For Seedance legs after leg 0, also provide the current scene’s approved concept with
`--image` as a non-boundary visual reference. The exact previous frame remains
`--start-image`; never swap those roles. Kling 3.0 has no separate image-reference input,
so its later architecture-A scenes rely on the prompt and have higher drift risk.

```
Single continuous cinematic camera move, no cuts. **Continue the same slow, steady
forward glide.** [MID-LEG MOVE — optional, from the library below.] The camera moves
into [SCENE i] toward [FOCAL POINT]. **In the final second, settle back into a slow,
steady forward glide toward [the doorway / opening / direction of the next scene].**
[STYLE tail + PALETTE]. Smooth, graceful, slow motion, subtle parallax. No text, no captions.
```

### Mid-leg move library (pick by concept; omit for a plain glide)

Reversals are safe *inside* a leg (it's one continuous render) — only a seam may never
reverse. That's why "ease back out" is fine mid-leg.

- **Half-orbit** (product, luxury): "sweeping in a slow half-orbit around [the hero
  object], keeping it centered, then continuing past it"
- **Crane-up reveal** (scale, atriums, campuses): "rising smoothly as the full scale of
  [the space] reveals below"
- **Low lateral track** (production lines, counters, shelves): "tracking low and level
  alongside [the line], foreground objects sliding past in parallax"
- **Push-in + ease back** (craft, detail): "pushing in close to [the craft moment] until
  it nearly fills the frame, then easing gently back out"
- **Rise-and-swoop** (travel, outdoors): "climbing in a gentle arc over [the terrain],
  then swooping down toward [the next focal point]"

After rendering each leg, **check its last frame** before generating the next: it should
read as a frame from a calm forward glide (no motion blur sideways, no half-finished
orbit). Present the full candidate for thumbs-up/down. If rejected, apply the user's
feedback and revise this leg only; a bad or unapproved handoff frame must never feed the
next leg.

## Dive-in clip prompt (SKILL Phase 4)

`--start-image = the scene still` (solid-bg version).

```
Single continuous cinematic camera move, no cuts. Begin high and far, looking down at the
whole [SECTION.subject] from outside like a tiny model. The camera slowly glides forward
and descends toward it, sweeping in toward [FOCAL POINT — the counter/the cauldrons/the
people], as if flying inside. As the camera pushes in, the roof and upper structure
gently lift and open away to reveal the warm interior. [STYLE tail: soft matte clay
diorama, tilt-shift miniature, warm light, [PALETTE]]. Smooth, graceful, slow motion,
subtle parallax. No text, no captions.
```

For scenes with no building to open (a field, a plaza, a road), replace the roof clause
with "the camera flies low across [the scene] toward [focal point]."

Generate and review dives one at a time. Lock the approved dive set before any connector
generation.

Params by chain model (SKILL Phase 4): seedance —
`--mode std --resolution 1080p --aspect_ratio 16:9 --duration 8`, no audio flag;
kling3_0 — `--mode std --sound off --aspect_ratio 16:9 --duration 10` (no `--resolution`
param). Same for architecture-A legs.

## Connector clip prompt (SKILL Phase 4)

`--start-image = dive_i LAST frame` (extracted), `--end-image = dive_{i+1} FIRST frame`
(extracted). Both from the RENDERED videos, not the stills.

```
Single continuous cinematic camera move, no cuts. The camera smoothly pulls up and back
out of [SCENE i], rising into the sky, then glides forward across the connected miniature
world and arrives above [SCENE i+1], beginning to descend toward it. One connected
miniature clay world, seamless flowing aerial transition. [STYLE tail + PALETTE]. Smooth
graceful slow motion. No text, no captions.
```

For the last connector into a hero-product finale: "…glides forward and the world
dissolves toward a single giant [PRODUCT] floating in soft [BG] space, arriving in front
of it."

seedance: `--mode std --resolution 1080p --aspect_ratio 16:9 --duration 5`; kling3_0:
`--mode std --sound off --aspect_ratio 16:9 --duration 5`. Connectors need `--end-image`
→ use a roster model that accepts it (SKILL Phase 4).

Generate and review connectors one at a time. Show both required seam frames beside the
candidate boundary frames; technical frame matching does not replace human approval of
the motion between them.

## Copy per section (for the engine config)

- `eyebrow` — 2–4 words, uppercase feel (a value-prop label).
- `title` — 3–6 words, the beat's headline. First section = the site's hero line; last =
  the payoff + it carries the CTA.
- `body` — one sentence, plain-spoken, from the visitor's side.
- `tags` — 0–3 short proof chips (e.g. "Fresh-cooked", "30-min delivery").
