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
/plugin marketplace add Tomalin18/scroll-world
/plugin install scroll-world@scroll-world
```

Then just ask for a scroll-through world landing page, or invoke `/scroll-world`.

### Codex & other agents — via the skills CLI

Using [Vercel's skills CLI](https://github.com/vercel-labs/skills), which installs into
Codex, Claude Code, Cursor, and 20+ other agents:

```bash
npx skills add Tomalin18/scroll-world            # pick your agent(s) when prompted
npx skills add Tomalin18/scroll-world -a codex   # or target Codex directly
```

In Codex, invoke it with `$scroll-world` (or `/skills` to browse), or just ask for a
scroll-through world landing page.

### Manually (drop-in skill)

Copy the skill folder into your agent's skills directory:

```bash
git clone https://github.com/Tomalin18/scroll-world
cp -R scroll-world/skills/scroll-world ~/.claude/skills/   # Claude Code
cp -R scroll-world/skills/scroll-world ~/.codex/skills/    # Codex
```

## Requirements

- OpenAI image generation through your agent's image tool, such as Codex `$imagegen`
  with `gpt_image_2`, for the scene stills.
- A fal.ai API key in `.env` for frame-locking image-to-video generation:

  ```bash
  FAL_KEY=...
  # or
  export FAL_KEY=...
  ```

- Node.js and npm, with `@fal-ai/client` installed in the project that will run
  generation scripts:

  ```bash
  npm init -y
  npm install @fal-ai/client
  ```

- `ffmpeg` / `ffprobe` for frame extraction, normalization, encoding, and QA.
- `jq` for shell-side JSON checks when using the reference scripts.
- Optional: Python 3 with Pillow or `cwebp`/`sips` for transparent-scene knockout and
  image conversion.
- Optional legacy provider: the [Higgsfield CLI](https://higgsfield.ai), authenticated
  with `higgsfield auth login`, only if you explicitly choose Higgsfield instead of the
  default fal.ai flow.

## What it does

It leans on OpenAI image generation for cohesive stills and fal.ai Kling V3 standard for
frame-locking image-to-video clips. The page then scrubs those pre-rendered clips by
scroll position — the same technique behind Apple's scroll-through product pages. The
camera genuinely moves; scroll only drives time. It's **framework-agnostic**: you get a
provider-aware pipeline, prompt templates, and a portable vanilla-JS scrub engine that
drops into plain HTML, Next.js, Vue, or a Python-served page — nothing assumes a stack.

When invoked, the skill:

1. **Interviews you** — the subject/industry + pitch, a brand kit (import from a URL, hand
   it over, or have it proposed), art direction, the ordered scenes the camera visits,
   and whether you want the **mobile beta**. Mobile uses lighter 720p encodes and engine
   hardening; portrait phones still crop the 16:9 frame, so compositions must keep the
   subject centered.
2. **Generates the assets** — one still per scene, one "dive-in" camera
   clip per scene, and the **connector** clips that join consecutive scenes, generated
   from the actual rendered frames of their neighbours so every seam is frame-identical.
   The default video provider is fal.ai `fal-ai/kling-video/v3/standard/image-to-video`;
   legacy Higgsfield support remains documented for users who choose it.
3. **Wires it up** — a config-driven scroll engine that plays the whole chain as one
   flight, serving mobile encodes automatically on phones when they exist.

## First-run checklist

Before spending provider credits, the skill now checks:

```bash
node -v
npm -v
ffmpeg -version
ffprobe -version
jq --version
```

It also verifies `.env` without printing secrets, confirms `FAL_KEY` is present, and
saves every fal response JSON before download so local download or encode failures can
resume without re-rendering paid jobs.

## What's in the skill

```
skills/scroll-world/
├── SKILL.md                    the procedure + the seam rule + gotchas
└── references/
    ├── prompts.md              intake checklist + provider-aware prompt templates
    ├── pipeline.md             fal.ai-first runbook (generate → frames → connectors → encode)
    ├── scrub-engine.js         portable, config-driven scrub engine (blob-seek, lazy load, seam crossfade)
    ├── index-template.html     a minimal standalone page that mounts the engine
    └── knockout.py             background knockout for floating scenes
```

## Notes

- Asset generation costs provider credits. A full architecture-B run is roughly `N` stills,
  `N` scene videos, and `N-1` connector videos. Mobile beta reuses the same raw videos and
  creates lighter `-m.mp4` encodes instead of generating a separate portrait chain.
- The generated `.mp4`/`.webp` assets are produced per project; they're not shipped here.
- Known failure cases are documented in `SKILL.md`: fal response shape differences,
  `.env` key leakage, near-16:9 Kling output such as `1280x716`, stale local ports,
  disabled connector scroll bands, and browser QA selector drift.

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
