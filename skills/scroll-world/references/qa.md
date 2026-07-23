# QA and regression matrix

Test a production build. Development diagnostics, hot reload, and unoptimised assets distort performance.

## Automated contracts

Copy/adapt `assets/tests/scroll-world-engine.test.mjs.template` into the project’s test suite. Keep the engine helpers exported for deterministic unit tests. Cover:

- Media time maps directly to the latest target and ignores sub-frame noise.
- Wheel deltas scale correctly for pixel, line, and page delta modes.
- Eight rapid wheel events accumulate eight times the travel.
- Smoothing moves farther for a farther accumulated target and snaps the final rounded pixel.
- Navigation follows its configured duration and section `focus` clamps to 0–1.
- Section index changes exactly at the next start boundary.
- Middle-button press cancels wheel and navigation animations.
- Disposal removes wheel/scroll/pointer/resize/orientation/load listeners, cancels frames, aborts requests, removes videos, and revokes Blob URLs.
- Poster adoption/deferred posters, demand-driven scrubbing, busy-decoder coalescing, and nearby-media unloading remain present.
- Bootstrap does not start Blazor when the initial first-still marker exists.
- Bootstrap starts Blazor manually elsewhere, registers lifecycle after `Blazor.start()`, disposes at navigation start, and resets instantly before remount at end.
- Root routes remain static SSR while an InteractiveAuto warmup descriptor exists.
- SSR homepage links to every public service/contact route.
- Robots and sitemap contain the approved production origin/routes.

Follow existing repository requirements. If Blazor tests use Reqnroll + bUnit, write business-readable feature scenarios and step definitions instead of direct code-first tests.

## Browser interaction matrix

At desktop width test:

1. Load at scroll 0 and wait at least 12 seconds. Confirm no late layout replacement or framework startup.
2. One wheel notch: immediate smooth progress, no seconds-long stall.
3. Six notches from the top after all initial assets settle: no hesitation, no long task, no skipped travel.
4. Eight rapid notches: farther/faster travel than one notch, with no overwritten target.
5. Reverse before settling: movement changes direction predictably from the accumulated target.
6. Drag the scrollbar and use keyboard/PageDown: native position is respected.
7. Hold middle button and drag: Chrome autoscroll owns movement; releasing does not jump back.
8. Click every route dot: approximately 1800 ms cinematic move to the chosen meaningful frame.
9. Cross boundaries one pixel each way: copy fully transitions to the entered section, independent of further scrolling.
10. At every seam capture frames immediately before/after while travelling both directions.
11. Navigate home → service/contact: destination appears at y=0 with no visible outgoing-page rush.
12. On non-home pages, verify native wheel/touch/scrollbar behaviour and no engine media/listeners.
13. Direct-load an interactive page, validate the form, then enhanced-navigate home: runtime remains, y=0, engine mounted.

Repeat essential loading/scroll checks at phone portrait/landscape. If native mobile media was purchased, verify portrait files and posters are actually selected (`videoWidth < videoHeight`), CPU throttle 4–6×, collapse the URL bar, rotate, and test iOS Safari priming. A desktop-only build still needs graceful phone fallback with no overlap/blank scene.

Test reduced motion: no video network requests, stills remain meaningful, particles and wheel animation are absent.

## Performance/network assertions

Record rather than eyeball:

- Fresh home after extended idle: zero `_framework`, Blazor Server circuit, boot JSON, DLL/WASM, or runtime requests.
- Direct interactive page: framework starts after paint/idle and InteractiveAuto becomes usable.
- Retained-runtime home: first wheel target update should occur within one frame or a small number of milliseconds, without long tasks.
- No permanent requestAnimationFrame loop while idle.
- Only nearby clips are live (roughly four for a typical chain); distant fetches abort and disposed Blob URLs revoke.
- First still is the LCP candidate, responsive source chosen, no CLS from missing dimensions.

Run Lighthouse against the production endpoint with consistent desktop and mobile profiles. Report Performance, Accessibility, Best Practices, SEO, LCP, CLS, INP/TBT proxy, speed index, transfer size, request count, largest assets, unused JS/CSS, render blockers, and console/network errors. Targets are guardrails, not fabricated results: categories ≥95, local LCP <1 s where realistic, CLS <0.1, INP <200 ms.

Inspect the raw initial HTML with an HTTP client: title, meta description, canonical, H1, service copy, internal links, and JSON-LD must be present before JS. Validate sitemap links and JSON-LD syntax/semantics.

## Visual tuning pass

For each section record:

- Start/end scroll position.
- Frame at route-dot `focus`.
- Whether copy obscures the subject.
- Whether `scroll` gives enough viewing time.
- Whether `linger` holds the meaningful action without making edge motion unnaturally fast.
- Seam continuity.

Tune actual footage. Especially inspect the finale: generated clips often reveal/open the final subject late, so a default midpoint is commonly wrong.
