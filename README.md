# scroll-world


https://github.com/user-attachments/assets/b08e641e-985b-4bd4-83ff-6750272d0c37


A Claude Code skill that builds an immersive, **scroll-scrubbed "fly through the world"
landing page** for any industry or brand — the kind where, as you scroll, a camera flies
from *outside* each scene *into* its interior, then flows on to the next scene with **no
cuts**. One continuous connected flight through a little generated world (think the Emons
logistics site, applied to whatever you want).

## Install

### As a plugin (recommended)

```
/plugin marketplace add oso95/scroll-world
/plugin install scroll-world@scroll-world
```

Then just ask for a scroll-through world landing page, or invoke `/scroll-world`.

### Manually (drop-in skill)

Copy the skill folder into your Claude Code skills directory:

```bash
git clone https://github.com/oso95/scroll-world
cp -R scroll-world/plugins/scroll-world/skills/scroll-world ~/.claude/skills/
```

## Requirements

- The [Higgsfield CLI](https://higgsfield.ai), authenticated (`higgsfield auth login`),
  with credits.
- `ffmpeg` / `ffprobe` for frame extraction and encoding.
- Python 3 with Pillow (optional — only for the transparent-scene knockout).

## What it does

It leans on [Higgsfield](https://higgsfield.ai) for the art: cohesive isometric diorama
scenes (GPT Image 2) and the camera flights themselves (Seedance image-to-video), scrubbed
by scroll position — the same technique behind Apple's scroll-through product pages. The
camera genuinely moves; scroll only drives time. It's **framework-agnostic**: you get the
Higgsfield pipeline, the prompt templates, and a portable vanilla-JS scrub engine that
drops into plain HTML, Next.js, Vue, or a Python-served page — nothing assumes a stack.

When invoked, the skill:

1. **Interviews you** — the subject/industry + pitch, a brand kit (import from a URL, hand
   it over, or have it proposed), art direction, and the ordered scenes the camera visits.
2. **Generates the assets** with Higgsfield — one still per scene, one "dive-in" camera
   clip per scene, and the **connector** clips that join consecutive scenes.
3. **Wires it up** — a config-driven scroll engine that plays the whole chain as one flight.

### The part that makes it good

The scenes connect **seamlessly** because each connector clip is generated with the
*actual rendered frames* of its neighbours as its start/end images (not the original
stills — those re-render slightly differently and would pop at the seam). Both sides of
every seam end up frame-identical, so the camera never cuts. This is baked into the skill
as the central rule.

It also captures the non-obvious production gotchas: blob-URL loading so scrubbing works on
hosts that don't serve HTTP byte-range requests, GOP/encoding settings that stay sharp
without bloating, and Higgsfield's quirks.

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

- Asset generation costs Higgsfield credits (~N image gens + ~2N-1 video gens for N scenes)
  and takes a while — the skill runs generations in the background and polls.
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
