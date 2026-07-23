# Homepage SSR, SEO/AEO, accessibility, and performance foundation

This skill owns the cinematic homepage only. Preserve existing site-wide content and SEO
infrastructure. Supporting pages may be linked when they already exist, or created only as
minimal placeholders when explicitly approved.

## Homepage content boundary

Render a concise semantic equivalent of every cinematic section in the homepage’s initial
HTML: one descriptive H1, logical H2s, short paragraphs, proof supplied by the user, and
human-readable links. Keep business name, offer terminology, audience, service area, and
expertise consistent and natural. Put a direct answer/value statement near each heading so
the content is useful to humans, traditional search, and answer engines.

Do not write substantive service, about, contact, legal, blog, location, or FAQ pages. Do
not invent customers, quotes, awards, guarantees, reviews, prices, credentials, response
times, or business facts.

When a homepage link has no destination, either remove it, use an approved external
destination, or create a minimal placeholder containing only a heading, short “Coming soon”
message, and link home. Mark a skill-created placeholder `noindex,follow`; do not optimise
placeholder content for search.

## Homepage metadata

Return these in the initial homepage HTML without JavaScript:

- A specific `<title>` and concise meta description.
- Absolute homepage canonical URL using the approved production origin.
- Open Graph title, description, URL, image, and descriptive image alt.
- Twitter card metadata.
- One descriptive H1 and logical H2/H3 hierarchy.

Do not create or rewrite metadata for other routes. Do not take ownership of robots.txt or
sitemap.xml. Read existing crawl controls only to confirm the homepage is not blocked; report
problems rather than broadening the task into site-wide SEO work.

## Homepage structured data

Generate JSON with `System.Text.Json`, not string concatenation. Use stable `@id` values.
Limit the graph to truthful homepage entities: `WebPage`, `WebSite`, and
`Organization`/`LocalBusiness` only when the required facts are supplied. The organization
may use `makesOffer` with `Offer`/`Service` nodes for offers visibly summarized on the
homepage. Do not emit supporting-page `FAQPage`, `BreadcrumbList`, `ContactPage`, review,
rating, or invisible-content schema as part of this skill.

Validate serialized JSON and the rendered production homepage. Schema supports entity
understanding; it does not guarantee rich results.

## Accessible dual-layer homepage

Target WCAG 2.2 AA for the skill-created homepage. Preserve stronger existing project
standards.

The visual engine copy is presentation-only because the same content exists in SSR HTML:

- Visual layer: `aria-hidden="true"`; duplicate links `tabindex="-1"`.
- SSR layer: normal semantic headings, paragraphs, lists, and links. Visually hide it only
  with a proven screen-reader-only utility—not `display:none`, `hidden`, or `aria-hidden`.
- When the visible JS top navigation duplicates an SSR-layer destination, remove the hidden
  duplicate from sequential keyboard focus with `tabindex="-1"` while retaining its link
  semantics for virtual-cursor/no-script discovery. Verify every destination remains
  keyboard-accessible through a visible homepage control.
- Decorative still/video alt is empty because the semantic copy explains the page.
- Route dots have button semantics, accessible labels, visible focus, and programmatic active
  state.
- Honour `prefers-reduced-motion`: show/crossfade stills and never load video.
- Maintain WCAG contrast across every changing scene; keep the scroll hint conspicuous.
- Ensure keyboard users can reach real homepage links without duplicate generated CTAs.
- Reject rapid flashing/flicker in generated media and keep the background film muted.

## Homepage compliance boundary

Do not add analytics, tracking pixels, marketing cookies, or consent tooling unless the user
explicitly asks and supplies the relevant requirements. Preserve existing consent/privacy
behaviour and report any interaction with the homepage. Do not draft legal pages or claim
legal compliance; those remain supporting-site responsibilities.

## First image and LQIP

Use a responsive `<picture>` built from exact frame 0 of the approved first section video,
not its differently shaped concept still. Size it to actual viewport needs and use the real
intrinsic dimensions. Include eager loading, async decode, and high fetch priority. If a
native portrait chain exists, put its 480/720-wide frame-0 sources before the desktop source
with an appropriate media query so mobile is correct before JavaScript.

Generate a low-quality image placeholder around 20–40 px wide and roughly 1 KB where
possible. Embed it as a CSS data URL or tiny asset behind the real image, scale to cover, and
blur slightly. Do not use the LQIP as the `<img src>` and replace it in JavaScript; that
delays LCP and harms no-JS output.

## Media delivery and CDN

Development assets may remain local. For production CDN delivery use:

- Content-hashed/versioned immutable URLs and long immutable cache headers.
- Correct `video/mp4`/image MIME types, CORS, and byte-range support.
- Same-origin or correctly CORS-enabled media because the engine fetches clips as Blobs.
- Image resizing only when it preserves the approved first-frame derivatives.
- Measurement-led preconnects; never speculative video preloads.

Large opening media remains the primary performance risk even with a CDN. The SSR first
picture should win LCP; load clips only after its poster is ready and near demand. Treat
local Lighthouse results as lab evidence, not a field guarantee; recommend production
75th-percentile Core Web Vitals/RUM after launch.
