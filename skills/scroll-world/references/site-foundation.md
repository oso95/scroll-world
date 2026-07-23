# Full-site, SEO/AEO, accessibility, and performance foundation

The cinematic homepage is an overview. Search and answer engines need explicit, useful, server-rendered pages behind it.

## Information architecture

Create one route for each real service/offer plus contact. Link every route from the homepage SSR copy, cinematic CTA/nav where appropriate, shared header/footer, related-service blocks, and sitemap. Keep names stable across headings, links, schema, and navigation.

Each service page should answer, in plain language:

1. Who it is for and the problem it solves.
2. Outcomes and concrete deliverables.
3. How engagement works.
4. Scope boundaries and dependencies.
5. Why this provider is credible, using only supplied facts.
6. Frequently asked buyer questions.
7. The next action.

Do not create thin location or keyword variants. Do not invent customers, quotes, awards, guarantees, review scores, prices, response times, or business details.

## SSR and metadata

Every public route must return its meaningful content in the initial HTML without JavaScript. Give each route a unique:

- `<title>` and concise meta description.
- Absolute canonical URL using the approved production origin.
- Open Graph title, description, URL, image, and descriptive image alt.
- Twitter card metadata.
- One descriptive H1 and logical H2/H3 hierarchy.

Use human-readable internal link labels. Include actual business name, offer terminology, service area, audience, and expertise naturally where true. Put concise direct answers near their corresponding headings; follow with detail, examples, constraints, and process. This makes content easy for traditional search, AI retrieval, and humans without writing robotic “AEO copy.”

## Structured data

Generate JSON with `System.Text.Json`, not string concatenation. Use one stable `@id` per entity. Typical graph:

- Home: `Organization` or the most specific truthful `LocalBusiness`, `WebSite`, `WebPage`, and `Offer`/`Service` relationships.
- Service: provider organization, `Service`, `WebPage`, `BreadcrumbList`, and `FAQPage` only when the same questions and answers are visibly rendered.
- Contact: provider organization, `ContactPage`, and `BreadcrumbList`.

Only claim known facts. Validate serialized JSON and a rendered production page. Schema supports entity understanding; it does not guarantee rich results.

## Crawl controls

Add a production `robots.txt` that allows legitimate crawling and names the absolute sitemap. Do not accidentally block Googlebot, Bingbot, OAI-SearchBot, ChatGPT-User, ClaudeBot, PerplexityBot, or other desired agents; check current owner policy before listing specific bots. Add every canonical public route to `sitemap.xml` and omit development/error/private routes. Use real deployment dates for `lastmod` or omit it rather than hardcoding a template date.

Return correct 404 status/content, keep URLs clean, avoid redirect chains, and verify canonical host/HTTPS behaviour at deployment.

## Accessible dual-layer homepage

The visual engine copy is presentation-only because the same content exists in SSR HTML:

- Visual layer: `aria-hidden="true"`; duplicate links `tabindex="-1"`.
- SSR layer: normal semantic headings, paragraphs, lists, and links. It may be visually hidden only with a proven screen-reader-only utility—not `display:none`, `hidden`, or `aria-hidden`.
- Decorative still/video alt is empty because the semantic copy explains the page.
- Route dots need button semantics and accessible labels; active state should be exposed when practical.
- Honour `prefers-reduced-motion`: show/crossfade stills and never load video.
- Maintain WCAG contrast across every changing scene; the scroll hint uses a high-contrast frosted capsule.
- Ensure keyboard navigation can reach real page links without traversing duplicate generated CTAs.

## First image and LQIP

Use a responsive `<picture>` sized to the actual viewport needs. Include explicit width/height or aspect ratio, eager loading, async decode, and high fetch priority. Compress visually, but preserve enough detail to function as the first scene.

Generate a tiny low-quality image placeholder (LQIP, often called a blur-up placeholder) around 20–40 px wide and roughly 1 KB where possible. Embed it as a CSS data URL or tiny asset behind the real image, scale to cover, and blur slightly. Do not set the LQIP as the `<img src>` and swap it in JS; that delays LCP and harms no-JS output.

## Contact

For demo mode use InteractiveAuto, `EditForm`, data-annotation validation, clear required/error text, a service selector, and an `aria-live` confirmation toast. State conspicuously that nothing is sent or stored. Disable submission until hydrated so static SSR cannot perform a misleading post. Do not add a fake delay.

For production delivery, first agree endpoint, spam protection, privacy retention, consent wording, success/failure behaviour, telemetry, email/CRM destination, and secrets management. Add server-side validation even when client validation exists.

## Media delivery and CDN

During development local assets are fine. In production a CDN such as Bunny can materially improve geographic latency and origin load. Use:

- Content-hashed/versioned immutable URLs.
- Long immutable cache headers for versioned media.
- Correct `video/mp4`/image MIME types, CORS, and byte-range support.
- A same-origin or properly CORS-enabled origin because the engine fetches clips as Blobs.
- CDN image resizing only when it preserves the intended first-frame derivatives.
- Preconnect only when measurements show it helps; avoid speculative video preloads.

Large opening media remains the biggest risk even with a CDN. The SSR first picture should win LCP; clips load only near demand.
