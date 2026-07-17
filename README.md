# scroll-world


https://github.com/user-attachments/assets/b08e641e-985b-4bd4-83ff-6750272d0c37


An agent skill — for Claude Code, Codex, and any `SKILL.md`-compatible agent — that
builds an immersive, **scroll-scrubbed "fly through the world" landing page** for any industry or brand — the kind where, as you scroll, a camera flies
from *outside* each scene *into* its interior, then flows on to the next scene with **no
cuts**. One continuous connected flight through a little generated world (think the Emons
logistics site, applied to whatever you want).

## Install

### Claude Code — as a plugin (recommended)

```
/plugin marketplace add oso95/scroll-world
/plugin install scroll-world@scroll-world
```

Then just ask for a scroll-through world landing page, or invoke `/scroll-world`.

### Codex & other agents — via the skills CLI

Using [Vercel's skills CLI](https://github.com/vercel-labs/skills), which installs into
Codex, Claude Code, Cursor, and 20+ other agents:

```bash
npx skills add oso95/scroll-world            # pick your agent(s) when prompted
npx skills add oso95/scroll-world -a codex   # or target Codex directly
```

In Codex, invoke it with `$scroll-world` (or `/skills` to browse), or just ask for a
scroll-through world landing page.

### Manually (drop-in skill)

Copy the skill folder into your agent's skills directory:

```bash
git clone https://github.com/oso95/scroll-world
cp -R scroll-world/skills/scroll-world ~/.claude/skills/   # Claude Code
cp -R scroll-world/skills/scroll-world ~/.codex/skills/    # Codex
```

## Requirements

- Either the [Higgsfield CLI](https://higgsfield.ai), authenticated (`higgsfield auth login`),
  with credits, **or** fal.ai (`python3 -m pip install fal-client requests` + `FAL_KEY`).
- `ffmpeg` / `ffprobe` for frame extraction and encoding.
- Python 3 with Pillow (for the mobile portrait canvases; also the optional
  transparent-scene knockout).
- The [Codex CLI](https://github.com/openai/codex) (optional) — if present, the scene
  stills can be generated through Codex's built-in `image_gen` (the same GPT Image
  model), billed to a ChatGPT subscription instead of Higgsfield credits.

## What it does

It leans on [Higgsfield](https://higgsfield.ai) by default (or fal.ai via the included adapter) for the art: cohesive isometric diorama
scenes (GPT Image 2 — via Higgsfield, fal.ai, or the Codex CLI on a ChatGPT subscription) and the
camera flights themselves (Seedance or Kling image-to-video — only models that can
frame-lock a seam), scrubbed
by scroll position — the same technique behind Apple's scroll-through product pages. The
camera genuinely moves; scroll only drives time. It's **framework-agnostic**: you get the
provider pipeline, the prompt templates, and a portable vanilla-JS scrub engine that
drops into plain HTML, Next.js, Vue, or a Python-served page — nothing assumes a stack.

When invoked, the skill:

1. **Interviews you** — the subject/industry + pitch, a brand kit (import from a URL, hand
   it over, or have it proposed), art direction, the ordered scenes the camera visits,
   whether you want the **mobile version** (a second chain rendered natively in 9:16
   portrait — composed for phones, not a crop of the landscape film), and the **budget** —
   render tiers and stills source shown with estimated credit costs, approved before
   anything generates.
2. **Generates the assets** with Higgsfield/fal.ai — one still per scene, one "dive-in" camera
   clip per scene, and the **connector** clips that join consecutive scenes, generated
   from the actual rendered frames of their neighbours so every seam is frame-identical.
   Mobile opt-in renders a parallel portrait chain the same way, frame-locked against its
   own 9:16 renders.
3. **Wires it up** — a config-driven scroll engine that plays the whole chain as one
   flight, serving the portrait clips and posters automatically on phones.

### The part that makes it good

The scenes connect **seamlessly** because each connector clip is generated with the
*actual rendered frames* of its neighbours as its start/end images (not the original
stills — those re-render slightly differently and would pop at the seam). Both sides of
every seam end up frame-identical, so the camera never cuts. This is baked into the skill
as the central rule.

It also captures the non-obvious production gotchas: blob-URL loading so scrubbing works on
hosts that don't serve HTTP byte-range requests, GOP/encoding settings that stay sharp
without bloating, mobile-native portrait chains, budget approval before spending credits,
and provider quirks.

## What's in the skill

```
skills/scroll-world/
├── SKILL.md                    the procedure + the seam rule + gotchas
└── references/
    ├── prompts.md              intake checklist + prompt templates
    ├── pipeline.md             Higgsfield copy-paste batch scripts (generate → frames → connectors → encode)
    ├── fal-ai.md               fal.ai provider notes + copy-paste commands
    ├── fal_pipeline.py         small fal-client adapter (upload → generate → download)
    ├── scrub-engine.js         portable, config-driven scrub engine (blob-seek, lazy load, seam crossfade)
    ├── index-template.html     a minimal standalone page that mounts the engine
    └── knockout.py             background knockout for floating scenes
```

## Notes

- Asset generation costs provider credits (Higgsfield/fal.ai; ~N image gens + ~2N-1 video gens for N
  scenes; the mobile chain doubles the video gens) and takes a while — the skill runs
  generations in the background and polls. Per-generation pricing can vary by provider/model,
  so the skill calibrates against your live balance where possible and states the estimated
  total before spending.
- The generated `.mp4`/`.webp` assets are produced per project; they're not shipped here.

## Star History

<a href="https://www.star-history.com/?type=date&repos=oso95%2Fscroll-world">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/chart?repos=oso95/scroll-world&type=date&theme=dark&legend=top-left&sealed_token=rsHNX9eWfbhlu820oC1dzsc66Y8UZI4dawuHvAUlbn36F0gwOWXRDi-Qq4QFopkoEJE7bzgXPUkAmSnmMcglxAo_rM7TvGDKFehk5MzprmeT2euDRbHnTQZIxEWwjjpGQ3nodpdblW6WjTssURtDxXO2MCVL_WgJ_WnCIoVbV8qhsB_Z-Eeo8KCyVerC" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/chart?repos=oso95/scroll-world&type=date&legend=top-left&sealed_token=rsHNX9eWfbhlu820oC1dzsc66Y8UZI4dawuHvAUlbn36F0gwOWXRDi-Qq4QFopkoEJE7bzgXPUkAmSnmMcglxAo_rM7TvGDKFehk5MzprmeT2euDRbHnTQZIxEWwjjpGQ3nodpdblW6WjTssURtDxXO2MCVL_WgJ_WnCIoVbV8qhsB_Z-Eeo8KCyVerC" />
   <img alt="Star History Chart" src="https://api.star-history.com/chart?repos=oso95/scroll-world&type=date&legend=top-left&sealed_token=rsHNX9eWfbhlu820oC1dzsc66Y8UZI4dawuHvAUlbn36F0gwOWXRDi-Qq4QFopkoEJE7bzgXPUkAmSnmMcglxAo_rM7TvGDKFehk5MzprmeT2euDRbHnTQZIxEWwjjpGQ3nodpdblW6WjTssURtDxXO2MCVL_WgJ_WnCIoVbV8qhsB_Z-Eeo8KCyVerC" />
 </picture>
</a>

## License

MIT — see [LICENSE](LICENSE).
