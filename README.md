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

**At least one video backend** — all three render the *same* Seedance 2.0, so this
is a billing choice, not a quality one:

| Backend | Needs | N=6 chain @1080p | Why pick it |
|---|---|---|---|
| [Monid](https://monid.ai) *(default)* | `monid` CLI + balance | **≈ $27** | Cheapest; per-clip cost reported per run |
| [fal.ai](https://fal.ai) | just a `FAL_KEY` | ≈ $50 | No CLI; lossless base64 frame handoff; stills + video on one key |
| [Higgsfield](https://higgsfield.ai) | `higgsfield` CLI, `auth login`, credits | ≈ $32 (Plus) | Spends an existing subscription; only home of `kling3_0` |

- The [Higgsfield CLI](https://higgsfield.ai) is also the usual source of the scene
  stills (`gpt_image_2`) — though fal serves the same model, and Codex can too.
- `ffmpeg` / `ffprobe` for frame extraction and encoding, plus `jq` and `curl`.
- A POSIX shell — the pipeline is bash. On Windows, use WSL or Git Bash.
- Python 3 with Pillow (for the mobile portrait canvases; also the optional
  transparent-scene knockout).
- The [Codex CLI](https://github.com/openai/codex) (optional) — if present, the scene
  stills can be generated through Codex's built-in `image_gen` (the same GPT Image
  model), billed to a ChatGPT subscription instead of Higgsfield credits.
- About the backends: Monid's seedance-2.0 was verified 2026-07-25 (first/last-frame
  conditioning frame-locks, so it renders the full seamless chain; frames travel via
  Monid's free workspace file system, JPEG-compressed on the way up). fal's
  `bytedance/seedance-2.0/image-to-video` takes `image_url` + `end_image_url` and
  accepts base64 data URIs, so its seam handoff is the exact PNG ffmpeg extracted —
  the most faithful of the three. Both are pay-per-use with no subscription or
  monthly expiry, and both price off the same token formula. The skill re-checks
  each endpoint's schema per build and keeps qualification probes in the pipeline
  for when a catalog moves — which it does, in both directions.

## What it does

It generates the art with AI: cohesive isometric diorama scenes (GPT Image 2 — via
Higgsfield, fal, or the Codex CLI on a ChatGPT subscription) and the camera flights
themselves (Seedance 2.0 image-to-video on **Monid, fal, or Higgsfield** — your
choice of biller, one model, and only models that can frame-lock a seam), scrubbed
by scroll position — the same technique behind Apple's scroll-through product pages. The
camera genuinely moves; scroll only drives time. It's **framework-agnostic**: you get the
Higgsfield pipeline, the prompt templates, and a portable vanilla-JS scrub engine that
drops into plain HTML, Next.js, Vue, or a Python-served page — nothing assumes a stack.

When invoked, the skill:

1. **Interviews you** — the subject/industry + pitch, a brand kit (import from a URL, hand
   it over, or have it proposed), art direction, the ordered scenes the camera visits,
   whether you want the **mobile version** (a second chain rendered natively in 9:16
   portrait — composed for phones, not a crop of the landscape film), and the **budget** —
   render tiers and stills source shown with estimated credit costs, approved before
   anything generates.
2. **Generates the assets** — one still per scene, one "dive-in" camera
   clip per scene, and the **connector** clips that join consecutive scenes, generated
   from the actual rendered frames of their neighbours so every seam is frame-identical.
   Mobile opt-in renders a parallel portrait chain the same way, frame-locked against its
   own 9:16 renders.
3. **Wires it up** — a config-driven scroll engine that plays the whole chain as one
   flight, serving the portrait clips and posters automatically on phones.

## What's in the skill

```
skills/scroll-world/
├── SKILL.md                    the procedure + the seam rule + gotchas
└── references/
    ├── prompts.md              intake checklist + every Higgsfield prompt template
    ├── pipeline.md             copy-paste batch scripts (generate → frames → connectors → encode)
    ├── scrub-engine.js         portable, config-driven scrub engine (blob-seek, lazy load, seam crossfade)
    ├── index-template.html     a minimal standalone page that mounts the engine
    └── knockout.py             background knockout for floating scenes
```

## Notes

- Asset generation costs money (~N image gens + ~2N-1 video gens; the mobile chain
  doubles the video gens) and takes a while — the skill runs generations in the
  background and polls. Monid and fal are token-priced (`w × h × 24 × s / 1024`, at
  $7/1M and $14/1M respectively), and Higgsfield prices any job for free up front via
  `higgsfield generate cost`. Either way the estimated total is stated before spending.
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
