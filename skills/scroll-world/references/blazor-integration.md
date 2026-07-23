# Blazor integration contract

Use this architecture for a server-hosted Blazor Web App with InteractiveAuto. Adapt namespaces and paths to the repository; preserve behaviour.

## Render-mode shape

The root document renders routes statically and includes a tiny InteractiveAuto warmup component:

```razor
<Routes />
<BlazorWarmup @rendermode="InteractiveAuto" />
<script type="module" src="@Assets["js/app-bootstrap.js"]"></script>
```

Do **not** put an interactive render mode on `Routes`; individual interactive pages/components choose `@rendermode InteractiveAuto`. Configure both sides:

```csharp
builder.Services.AddRazorComponents()
    .AddInteractiveServerComponents()
    .AddInteractiveWebAssemblyComponents();

app.MapRazorComponents<App>()
    .AddInteractiveServerRenderMode()
    .AddInteractiveWebAssemblyRenderMode()
    .AddAdditionalAssemblies(typeof(Client._Imports).Assembly);
```

Remove `<ResourcePreloader />`; it can request framework resources before the homepage guard runs. Do not include a normal `<script src="_framework/blazor.web.js">`. The application bootstrap injects it only away from an initial cinematic homepage.

## Why the warmup exists

`BlazorWarmup` ensures the server emits InteractiveAuto descriptors even though the route tree remains statically SSR-rendered. It does not itself boot Blazor. On a fresh homepage, the marker `[data-scroll-world-first-still]` makes `app-bootstrap.js` return permanently: no delayed timer, framework download, Server circuit, or WASM background load.

On a direct non-home visit, the bootstrap waits for two animation frames and browser idle, injects `_framework/blazor.web.js` with `autostart=false`, calls `Blazor.start()`, then installs enhanced-navigation handlers. The initial InteractiveAuto experience can use Server while the WebAssembly bundle downloads; cached later visits can use WASM.

If a visitor starts elsewhere and navigates home, Blazor is already running and remains so. The engine mounts after enhanced navigation.

## Atomic navigation lifecycle

The bootstrap is deliberately the single owner of enhanced-navigation events:

1. `enhancednavigationstart`: set an in-progress flag and dispose every mounted world immediately. This stops scroll animation/media work before DOM replacement.
2. `enhancedload`: sync only when a transition is not in progress. This avoids mounting into intermediate DOM.
3. `enhancednavigationend`: set destination scroll to 0 with `behavior: "instant"`, clear the flag, then sync/mount.

Do not scroll to zero from click handlers or before navigation; that visibly races the outgoing page upward. Do not wait until after mounting; the engine would calculate/read stale scroll.

The project-specific config module maintains a `Map` of mounted containers. `syncScrollWorlds()` disposes disconnected entries and mounts every matching SSR container once. The engine’s returned disposer owns all global listeners, animation frames, fetches, videos, and Blob URLs.

## Homepage structure

The SSR homepage contains:

- A route and non-interactive scroll-world layout.
- One stable container with a unique ID and `data-scroll-world="{{WORLD_KEY}}"`.
- A first-frame wrapper marked `data-scroll-world-first-frame`.
- A responsive `<picture data-scroll-world-first-picture>` with the `<img data-scroll-world-first-still>`.
- A semantic SSR copy section containing the real H1, all section summaries, and links to service/contact pages.

The JS engine adopts that existing `<picture>` into its first scene. It marks the generated visual copy layer `aria-hidden` and makes duplicate JS CTAs untabbable, so search engines and assistive technology use the SSR source without duplicate focus targets.

The first-frame wrapper needs a full-viewport background using the tiny blurred placeholder. Keep the real image eager, `fetchpriority="high"`, dimensions set, and its sources pre-sized. The LQIP prevents an empty flash; it must not delay the real image.

## Navigation rules

- A first visit to home has no Blazor runtime, so links perform full navigation naturally.
- Once Blazor has started, enhanced navigation may be used normally.
- External/service links in `navLinks` are anchors; route dots are buttons that animate within home.
- Native scroll applies outside the scroll-world container/route because the engine has been disposed.
- Do not add global `scroll-behavior: smooth`; it conflicts with exact engine and navigation ownership.

## Bundling and static assets

The templates use browser-valid ES modules with explicit `.js` imports, so a fresh project can place them under `wwwroot/js` and load `app-bootstrap.js` with `type="module"`. If the target already bundles JavaScript, feed the same sources through that pipeline and use its emitted asset path.

Enable response compression for text/framework assets. Map static assets using the app’s current .NET conventions. Do not preload video. Preload only the first local font if it is actually above the fold; subset/self-host fonts where licensing permits.

## Common regressions

- Homepage disappears after hydration: two render owners are replacing the SSR route. Keep `Routes` static and the warmup separate.
- Homepage stutters seconds later: a deferred startup timer still boots Blazor on initial home. The marker branch must return with no queued work.
- Destination sticks at old scroll: reset at enhanced-navigation end before remount.
- Outgoing page races upward: reset happened before/during the outgoing phase.
- Middle-button position snaps back: custom wheel target survived the middle press.
- Scroll gets slower with rapid wheel input: new deltas were based on current scroll rather than the unfinished accumulated target.
- Non-home pages remain expensive: disposal or route scoping is incomplete.
