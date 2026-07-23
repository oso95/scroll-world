# scroll-world

https://github.com/user-attachments/assets/b08e641e-985b-4bd4-83ff-6750272d0c37

An agent skill for building a complete, production-minded **Blazor Web App** around an immersive scroll-scrubbed camera flight.

As a visitor scrolls, a pre-rendered camera moves through a connected generated world. The experience can use an isometric diorama, grounded architectural walkthrough, or another approved art direction. The skill handles the business/brand discovery, frame-locked Higgsfield media pipeline, responsive encoding, the proven scroll engine, full service/contact pages, SSR-first SEO/AEO, Blazor InteractiveAuto lifecycle, tests, and performance QA.

## Install

### Claude Code — plugin

```text
/plugin marketplace add PinguApps/scroll-world
/plugin install scroll-world@scroll-world
```

Then invoke `/scroll-world`.

### Codex and other agents — skills CLI

```bash
npx skills add PinguApps/scroll-world
npx skills add PinguApps/scroll-world -a codex
```

In Codex, invoke `$scroll-world`.

### Manual

```bash
git clone https://github.com/PinguApps/scroll-world
cp -R scroll-world/skills/scroll-world ~/.codex/skills/
```

## Target

The skill is intentionally Blazor-first. It expects a server-hosted Blazor Web App that can use InteractiveAuto. If the project does not yet have a WebAssembly client/Auto support, the agent explains the structural change and asks before converting it.

It produces:

- A cinematic scroll-scrubbed homepage.
- Semantic SSR homepage content and responsive first-frame/LQIP delivery.
- Full-information pages for each real service or offer.
- A validated InteractiveAuto contact page (demo-only or connected, by explicit choice).
- Canonical/social metadata, truthful JSON-LD, robots, sitemap, internal links, accessibility, and reduced-motion support.
- A lifecycle-safe scroll engine limited to home; native scroll everywhere else.
- A fresh homepage that does not start/download Blazor, while interactive pages use Auto and retain the runtime when navigating back home.
- Behavioural regression tests plus browser, network, seam, and Lighthouse checks.

## Requirements

- A Blazor Web App targeting a currently supported .NET version.
- Authenticated [Higgsfield CLI](https://higgsfield.ai) with approved credits.
- `ffmpeg` and `ffprobe`.
- Python 3 + Pillow when background knockout or local LQIP tooling requires it.
- Optional Codex image generation for stills.

The skill audits these requirements but does not install tools, authenticate, switch workspaces, or spend credits without approval.

## Media choices

Every run explicitly chooses:

- Draft Mini (480/720p), efficient Seedance Fast (480/720p), production Seedance Standard (1080p), premium Seedance Standard (4K), or Kling Standard/Pro/4K alternate.
- Desktop only or a separate native 9:16 mobile chain. Native mobile roughly doubles video generation; a crop is never silently labelled mobile-optimised.
- Continuous forward architecture for grounded worlds or dive/connector architecture for miniature worlds.
- Higgsfield or available Codex image generation for all stills in the chain.

The seam rule is strict: neighbouring clips share actual rendered boundary frames. Scroll scrubs the resulting video; it does not render 3D in the browser.

Paid videos are never blasted through as a batch. The skill generates one candidate,
shows it with its prompt/settings/cost, and waits for a thumbs-up or thumbs-down with
feedback. Rejected revisions are preserved and logged; only an explicitly approved clip
can unlock the next dependent generation.

## Proven interaction defaults

- No scroll snapping or forced section stops.
- Accumulated wheel targets so fast wheel input always travels farther.
- Frame-time-aware smooth response; native touch, keyboard, scrollbar, and middle-button autoscroll.
- Copy changes quickly at exact section boundaries and stays fully settled within a section.
- Tunable meaningful route-dot landing frames and 1.8-second cinematic navigation.
- Demand-driven seeking, coalesced decoder work, nearby-only media, abort/revoke disposal, and no permanent animation loop.
- Atomic scroll-to-top during enhanced navigation, without the outgoing page visibly racing upward.

## Skill contents

```text
skills/scroll-world/
├── SKILL.md
├── agents/openai.yaml
├── assets/
│   ├── blazor/
│   │   ├── app-bootstrap.js
│   │   ├── scroll-world-index.js.template
│   │   ├── scroll-world.css.template
│   │   ├── App.razor.integration.template
│   │   ├── BlazorWarmup.razor
│   │   ├── Contact.razor.template
│   │   └── Home.razor.template
│   └── tests/scroll-world-engine.test.mjs.template
└── references/
    ├── prompts.md
    ├── pipeline.md
    ├── scrub-engine.js
    ├── blazor-integration.md
    ├── site-foundation.md
    ├── qa.md
    ├── media-gotchas.md
    ├── review-workflow.md
    └── knockout.py
```

Generated media is project-specific and is not stored in this repository.

## License

MIT — see [LICENSE](LICENSE).
