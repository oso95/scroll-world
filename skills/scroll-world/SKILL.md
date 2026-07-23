---
name: scroll-world
description: Build a production-quality Blazor Web App whose homepage is an immersive Higgsfield-generated, scroll-scrubbed camera flight. Use for scroll cinematics, 3D or diorama worlds, fly-through landing pages, or turning a business journey into an interactive world. Covers discovery, brand identity, seamless media generation, responsive encoding, a proven smooth scroll engine, SSR-first SEO/AEO, full service and contact pages, Blazor InteractiveAuto lifecycle, accessibility, regression tests, and Lighthouse/browser QA.
---

# Scroll World for Blazor

Build the whole public-facing Blazor site, not just a visual demo:

- A spectacular scroll-scrubbed homepage.
- Server-rendered, crawlable homepage copy and metadata.
- Full-information pages for each material service or offer.
- A contact page with appropriate Blazor interactivity.
- A homepage that does not download or start Blazor on a fresh direct visit.
- Blazor InteractiveAuto on interactive pages; once started, it remains available when enhanced navigation returns home.
- Smooth, accumulated wheel scrolling with native touch and middle-button autoscroll.
- Verified performance, accessibility, SEO/AEO, media lifecycle, and route behaviour.

The camera moves in pre-rendered video. Scroll controls time. The page never renders 3D in real time.

## Non-negotiable implementation contract

Preserve these defaults unless the user explicitly requests a different behaviour:

1. No scroll stops, snap points, or wheel-event-per-section navigation.
2. Desktop wheel deltas accumulate into one target. Rapid input must travel farther, never overwrite unfinished travel.
3. Smooth toward that target with frame-time-aware easing. Use `wheelMultiplier: 1` and `wheelResponse: 18` as the baseline.
4. Native scrolling owns touch, keyboard, scrollbar dragging, and Chrome middle-button autoscroll. A middle-button press cancels custom wheel/navigation animations.
5. Route dots animate for `navigationDuration: 1800`; each section may set `focus` to its most meaningful frame. Default `0.5`; finales often need `0.85–0.95` after visual QA.
6. Copy remains fully visible and motionless throughout a section. Crossing even 1 px into the next section triggers a quick independent fade. Reverse scroll reverses the section change.
7. Video seeking is demand-driven, coalesced while the decoder is busy, and jumps directly to the newest target. Never run a permanent 60 fps scrub loop.
8. Keep only nearby media loaded. Abort fetches, remove videos, and revoke Blob URLs when distant or disposed.
9. Leaving home removes every listener/frame/media resource. Non-home pages use native scrolling only.
10. Enhanced navigation resets the destination to scroll 0 atomically: unmount on navigation start, suppress remount during transition, set `scrollTo(... behavior: "instant")` at navigation end, then remount.
11. The initial homepage is SSR-only. If `[data-scroll-world-first-still]` exists on initial load, do not fetch `_framework/blazor.web.js`, server circuits, boot JSON, or WASM.
12. Non-home pages start Blazor after first paint/idle. Use InteractiveAuto so the first interactive visit can use Server while WASM downloads and later visits can use cached WASM.
13. If Blazor already started on another page, enhanced navigation home keeps that runtime and mounts the scroll world normally.
14. The first image is a server-rendered responsive `<picture>` with a tiny blurred LQIP fallback. Adopt it into the engine instead of duplicating it. Defer later posters.
15. Render meaningful headings, descriptions, and internal links in SSR HTML. The visual JS copy layer is `aria-hidden`; its duplicate CTA links are removed from tab order.

Use the canonical engine at `references/scrub-engine.js`. Do not rewrite or simplify its scheduling, scroll ownership, media cleanup, or lifecycle without adding regression coverage.

## Phase 1 — Inspect before changing anything

Read repository instructions and inspect the solution, current render modes, routes, layouts, asset pipeline, tests, and styling conventions. Preserve an existing design system. If none exists, use Tailwind CSS and build small project-local components; do not introduce a component library.

Confirm the app is a server-hosted Blazor Web App capable of InteractiveAuto. If it lacks a WebAssembly client or enabling Auto requires a structural conversion, explain that change and get approval before doing it.

Audit prerequisites without mutating the machine or account:

- `higgsfield` installed and authenticated; inspect workspace/credits.
- `ffmpeg` and `ffprobe` on PATH.
- Python 3 + Pillow only if knockout or LQIP tooling needs it.
- Optional Codex image generation route if available.

If anything is missing, report the exact requirement and command. Never install tools, authenticate, switch workspaces, buy/use credits, or change account state without explicit approval. Run generation only after the user approves the estimated spend.

## Phase 2 — Interview and lock the brief

Ask only decisions that change the result. Group questions into short rounds.

1. Subject, audience, location/service area, offers, proof, objections, CTA, contact details, and one-sentence commercial goal.
2. Brand source: import from an existing site, supplied kit, or propose a full identity for approval. Capture name, voice, typography direction, and 4–6 named colours.
3. Art direction and ordered journey. Propose 5–7 scenes derived from the customer journey or value chain. Every scene needs subject, eyebrow, headline, body, up to three tags, service link if relevant, and intended focal moment.
4. Camera architecture:
   - A: continuous forward chain for grounded walkthroughs. Recommended unless the world is intentionally miniature/map-like.
   - B: dives plus aerial connectors for diorama worlds.
5. Mobile media, always ask: desktop only or a second native 9:16 chain. Explain that native portrait approximately doubles video spend. Never silently call a centre crop “mobile-optimised.”
6. Quality, always inspect the live model schemas and ask:

   | Tier | Video route | Purpose |
   |---|---|---|
   | Draft/previz | `seedance_2_0_mini`, 480p or 720p | Lowest-cost motion/composition validation |
   | Efficient | `seedance_2_0`, Fast, 480p or 720p | Faster/lower-cost final delivery when HD is sufficient |
   | Production | `seedance_2_0`, Standard, 1080p | Default web-production master |
   | Premium master | `seedance_2_0`, Standard, 4K | Archive/crop headroom; expensive and rarely worth serving directly |
   | Alternate | `kling3_0`, Standard/Pro/4K mode | Different motion/look or filter fallback; verify native output with `ffprobe` |

   Also choose one still source for the whole chain:
   - Higgsfield `gpt_image_2`: 1K/2K/4K and low/medium/high; default 2K high.
   - Higgsfield `nano_banana_2`/Nano Banana Pro: 1K/2K/4K alternative when its
     composition style better suits the brief.
   - Codex image generation when available: no Higgsfield credits, but subject to Codex
     usage and its available output sizes.

   Never mix still models/sources within one chain.
   Ask whether to use standard or high source bitrate where the model exposes it. Disable
   generated audio: the homepage is muted and audio can materially increase credit cost.
7. Contact handling, always ask: demo-only (validation + toast; nothing sent/stored) or connect to the project’s approved backend. Default to demo-only until delivery/security requirements are explicit.
8. Deployment/media origin: local assets for development or a CDN. Capture the canonical production origin for metadata, robots, sitemap, and JSON-LD.

Calculate `N stills + (2N−1) accepted videos` for architecture B, or `N stills + N accepted sequential legs` for A; double accepted video work for native mobile. Show base cost separately from a realistic revision allowance (normally 25–50% for production review; more for ambitious motion). Calibrate with one approved still and one approved video because live prices vary. Stop for approval before paid generation.

Write down the approved choices and success criteria before generating.

## Phase 3 — Design the whole site

Create a distinctive identity and information architecture before media. The homepage is the “look at me” overview; it must link to substantive pages for every material offer and contact.

For each service page include: clear audience/problem, outcomes, process, deliverables, boundaries, proof or honest placeholders, related services, FAQs based on real buyer questions, and a contextual CTA. Avoid thin pages, keyword stuffing, invented testimonials, fake reviews, fake pricing, fake credentials, or unsupported claims.

Implement per-page title, description, canonical, Open Graph/Twitter metadata, accessible heading hierarchy, breadcrumbs, and only truthful JSON-LD. Add `Organization`/`LocalBusiness` as appropriate, `WebSite`, `WebPage`, `Service`, `BreadcrumbList`, and `FAQPage` only where visible FAQ content exists. Add robots and sitemap entries for every public page. Read `references/site-foundation.md` before implementation.

## Phase 4 — Generate a seamless media chain

Read `references/prompts.md`, `references/pipeline.md`, and `references/media-gotchas.md` completely before generating.

Use one byte-identical style preamble, palette, lens/lighting language, and still source throughout. Review all stills as a contact sheet before video.

Generate videos through the approval gate in `references/review-workflow.md`. Never batch,
parallelize, queue, or automatically continue through paid video generations:

1. Generate exactly one candidate.
2. Download it, create review frames/proxy, and present the video with its prompt, model,
   resolution, duration, revision number, and measured credit deduction.
3. Wait for an explicit thumbs-up/approval or thumbs-down with feedback.
4. On rejection, preserve the old candidate, record the fault, revise only what the
   feedback warrants, and generate one replacement within the approved revision budget.
5. Only an approved candidate may provide a boundary frame or allow the next video to begin.

Draft approval does not approve the production render: every re-rendered 1080p/4K candidate
must be reviewed again. Desktop approval does not approve the native portrait version.

The seam rule is absolute:

- Architecture A: each next leg starts from the previous leg’s actual final rendered frame. End and begin with the same gentle forward drift. No connectors.
- Architecture B: connector start = previous dive’s actual final frame; connector end = next dive’s actual first frame. Never use the original concept still as a connector endpoint.

Use one frame-locking video model across the chain. Supported roster: `seedance_2_0`, `seedance_2_0_mini`, `kling3_0`. Verify the current model schema before the first candidate. A requested alternative is valid only if its start/end conditioning satisfies the chosen architecture.

Keep raw outputs. Encode desktop H.264 at native resolution, CRF about 20, GOP 8, fixed keyframe interval, yuv420p, no audio, faststart, with restrained sharpening. Native mobile is portrait, typically 720 px wide, CRF about 23, GOP 4. Do not use all-intra or upscale native 720p output. The engine fetches clips to Blob URLs so seekability does not depend on host byte-range support.

Generate responsive first-still sources (at least 640, 960, and full width), dimensions, and a tiny blurred placeholder. The placeholder is the initial CSS background, not a replacement for the eagerly loaded high-priority first image.

## Phase 5 — Integrate with Blazor

Read `references/blazor-integration.md` completely. Copy/adapt:

- `references/scrub-engine.js` → the client source tree.
- `assets/blazor/scroll-world-index.js.template` → a project-specific config/mount module.
- `assets/blazor/app-bootstrap.js` → the main JS entry.
- `assets/blazor/BlazorWarmup.razor` → a shared client component.
- `assets/blazor/Home.razor.template` → the homepage structure.
- `assets/blazor/scroll-world.css.template` → critical first-frame/LQIP and theme CSS.
- `assets/blazor/App.razor.integration.template` → root SSR/runtime wiring.
- `assets/blazor/Contact.razor.template` → demo-safe InteractiveAuto form behaviour.

Replace every `{{PLACEHOLDER}}`; never ship template tokens. Keep the config data-driven. Tune `scroll`, `linger`, and `focus` against actual rendered frames rather than assuming equal pacing. A scene’s copy transition is boundary-based; `linger` affects video time only.

Use the project’s existing JS bundler if present. If it has none, the templates are browser-valid ES modules and can live under `wwwroot/js`. Remove the stock `<ResourcePreloader />` and stock `blazor.web.js` script. Load only the application module normally; it loads `blazor.web.js` away from a fresh homepage.

## Phase 6 — Test and tune

Read `references/qa.md`. Add regression tests in the repository’s established test stack. For Blazor UI, follow its behavioural/Reqnroll/bUnit conventions if present. At minimum cover the pure scroll helpers and source/lifecycle contracts from `assets/tests/scroll-world-engine.test.mjs.template`.

Verify in a real browser, not only unit tests:

- Slow wheel, rapid wheel bursts, reversing direction, scrollbar drag, middle-button autoscroll, route dots, touch, keyboard, reduced motion.
- Copy changes exactly at boundaries and remains fully settled otherwise.
- Every scene’s meaningful stop, especially the finale; tune `focus` visually.
- Home → other route starts at 0 without a visible pre-navigation rush; other route → home also starts at 0.
- No scroll engine handlers or media work on non-home routes.
- Fresh direct homepage after an extended idle makes zero Blazor framework/server/WASM requests.
- Direct interactive page hydrates; InteractiveAuto works; then enhanced navigation home keeps the existing runtime and mounts the cinematic.
- Only nearby clips remain loaded; leaving home aborts/revokes everything.
- Seams in both directions, desktop and opted-in mobile.

Build and run all relevant tests. Run Lighthouse in a production build for performance, accessibility, best practices, and SEO; inspect the SSR HTML as a crawler; validate JSON-LD and links. Aim for all Lighthouse categories ≥95, LCP <1 s on the local production profile when realistic, CLS <0.1, INP <200 ms, no long tasks during scroll, and no framework cost on a fresh homepage. Report measured results and remaining media/CDN risks honestly.

## Phase 7 — Handoff

Deliver:

- The finished Blazor site and generated assets.
- A short list of approved choices and tuned per-section pacing/focus values.
- Build/test/Lighthouse/network results.
- Credit use and rerolls.
- Any deployment assumptions. For a CDN such as Bunny, recommend versioned immutable URLs, Brotli for text assets, correct MIME/CORS, long cache lifetimes, and byte-range support; Blob loading still provides robust local seekability.
- A clear note if mobile is desktop fallback/crop rather than native portrait, or if contact remains demo-only.

Do not claim completion until the solution builds, relevant automated tests pass, browser behaviour is verified, and the fresh-home no-Blazor network assertion passes.

## Reference routing

- `references/prompts.md` — intake and image/video prompt patterns.
- `references/pipeline.md` — Higgsfield, frame extraction, encoding, native mobile chain.
- `references/scrub-engine.js` — canonical engine; copy rather than reimplement.
- `references/blazor-integration.md` — exact SSR/InteractiveAuto and enhanced-navigation wiring.
- `references/site-foundation.md` — full pages, SEO/AEO, schema, accessibility, LQIP, CDN.
- `references/qa.md` — regression and browser/performance matrix.
- `references/media-gotchas.md` — generation, seam, encoder, and device failure guide.
- `references/review-workflow.md` — mandatory one-candidate-at-a-time approval ledger.
- `references/knockout.py` — optional border-connected background knockout.
- `assets/blazor/*` — integration and critical-CSS templates.
- `assets/tests/*` — portable Node regression-test template.
