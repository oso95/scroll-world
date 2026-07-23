import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const skillRoot = new URL("../skills/scroll-world/", import.meta.url);
const read = path => readFile(new URL(path, skillRoot), "utf8");

const engineSource = await read("references/scrub-engine.js");
const engineModule = await import(`data:text/javascript;base64,${Buffer.from(engineSource).toString("base64")}`);
const bootstrapSource = await read("assets/blazor/app-bootstrap.js");
const configTemplate = await read("assets/blazor/scroll-world-index.js.template");
const homeTemplate = await read("assets/blazor/Home.razor.template");
const skillSource = await read("SKILL.md");

test("skill frontmatter is portable and Blazor-specific", () => {
  const frontmatter = skillSource.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] ?? "";
  assert.match(frontmatter, /^name: scroll-world$/m);
  assert.match(frontmatter, /^description:/m);
  assert.doesNotMatch(frontmatter, /^allowed-tools:/m);
  assert.match(frontmatter, /Blazor Web App/);
  assert.ok(skillSource.split(/\r?\n/).length < 500);
});

test("plugin metadata identifies the Blazor-first PinguApps fork", async () => {
  const plugin = JSON.parse(await readFile(new URL("../.claude-plugin/plugin.json", import.meta.url), "utf8"));
  const marketplace = JSON.parse(await readFile(new URL("../.claude-plugin/marketplace.json", import.meta.url), "utf8"));
  assert.equal(plugin.version, "1.1.0");
  assert.equal(plugin.author.name, "PinguApps");
  assert.equal(plugin.homepage, "https://github.com/PinguApps/scroll-world");
  assert.match(plugin.description, /Blazor Web App/);
  assert.match(marketplace.plugins[0].description, /InteractiveAuto/);
});

test("all routed resources and templates exist", async () => {
  for (const path of [
    "references/prompts.md",
    "references/pipeline.md",
    "references/scrub-engine.js",
    "references/blazor-integration.md",
    "references/site-foundation.md",
    "references/qa.md",
    "references/media-gotchas.md",
    "references/review-workflow.md",
    "references/knockout.py",
    "assets/blazor/app-bootstrap.js",
    "assets/blazor/scroll-world-index.js.template",
    "assets/blazor/scroll-world.css.template",
    "assets/blazor/App.razor.integration.template",
    "assets/blazor/Contact.razor.template",
    "assets/blazor/BlazorWarmup.razor",
    "assets/blazor/Home.razor.template",
    "assets/tests/scroll-world-engine.test.mjs.template",
    "agents/openai.yaml"
  ]) {
    await access(new URL(path, skillRoot));
  }
});

test("wheel input accumulates and scales across browser delta modes", () => {
  const { accumulatedWheelTarget, scaledWheelDelta } = engineModule;
  assert.equal(scaledWheelDelta(100, 0, 720, 1), 100);
  assert.equal(scaledWheelDelta(1, 1, 720, 5), 80);
  assert.equal(scaledWheelDelta(1, 2, 720, 5), 3600);
  let target = null;
  for (let i = 0; i < 8; i++) target = accumulatedWheelTarget(target, 0, 100, 5000);
  assert.equal(target, 800);
});

test("smooth response is distance-sensitive, prompt, and cannot stall on a rounded pixel", () => {
  const { smoothWheelPosition } = engineModule;
  const one = smoothWheelPosition(0, 100, 16, 18);
  const eight = smoothWheelPosition(0, 800, 16, 18);
  assert.ok(one > 0 && one < 100);
  assert.ok(eight > one * 7.9);
  assert.ok(smoothWheelPosition(0, 600, 16, 18) > 350);

  let position = 0;
  for (let frame = 0; frame < 120 && position !== 600; frame++) {
    position = Math.round(smoothWheelPosition(position, 600, 16, 35));
  }
  assert.equal(position, 600);
});

test("section copy and navigation calculations preserve the tuned behaviour", () => {
  const { navigationScrollPosition, sectionNavigationTarget, sectionIndexForPosition } = engineModule;
  assert.equal(navigationScrollPosition(0, 1000, 900, 1800), 500);
  assert.equal(sectionNavigationTarget(100, 500), 300);
  assert.equal(sectionNavigationTarget(100, 500, 0.88), 452);
  assert.equal(sectionIndexForPosition([0, 1742, 3413], 1741), 0);
  assert.equal(sectionIndexForPosition([0, 1742, 3413], 1742), 1);
});

test("engine keeps native middle-button ownership and releases all work", () => {
  assert.match(engineSource, /event\.button !== 1/);
  assert.match(engineSource, /function onPointerDown[\s\S]*?cancelNavigation\(\)[\s\S]*?cancelWheelScroll\(\)/);
  assert.match(engineSource, /removeEventListener\('wheel', onWheel\)/);
  assert.match(engineSource, /cancelAnimationFrame\(scrubFrame\)/);
  assert.match(engineSource, /new AbortController\(\)/);
  assert.match(engineSource, /revokeObjectURL/);
});

test("engine adopts SSR media, defers posters, and scrubs only on demand", () => {
  assert.match(engineSource, /data-scroll-world-first-picture/);
  assert.match(engineSource, /data-scroll-world-first-frame/);
  assert.match(engineSource, /dataset\.poster/);
  assert.match(engineSource, /function scheduleScrub\(\)/);
  assert.match(engineSource, /if \(s\.video\.seeking\) continue/);
  assert.doesNotMatch(engineSource, /function raf\(\)[\s\S]*?requestAnimationFrame\(raf\)[\s\S]*?\n\s*}/);
});

test("bootstrap never starts Blazor on a fresh cinematic homepage", () => {
  assert.match(bootstrapSource, /data-scroll-world-first-still/);
  assert.match(bootstrapSource, /if \(firstFrame\) return/);
  assert.doesNotMatch(bootstrapSource, /interactionQuietPeriod|minimumDelay|markInteraction/);
});

test("root integration removes framework preloading", async () => {
  const appTemplate = await read("assets/blazor/App.razor.integration.template");
  assert.match(appTemplate, /REMOVE: <ResourcePreloader/);
  assert.match(appTemplate, /BlazorWarmup/);
  assert.match(appTemplate, /type="module"/);
});

test("bootstrap starts Auto elsewhere and performs atomic enhanced navigation", () => {
  assert.match(bootstrapSource, /script\.src = "_framework\/blazor\.web\.js"/);
  assert.match(bootstrapSource, /await globalThis\.Blazor\.start\(\)/);
  assert.match(bootstrapSource, /enhancednavigationstart/);
  assert.match(bootstrapSource, /function onEnhancedNavigationStart\(\)[\s\S]*?unmountScrollWorlds\(\)/);
  assert.match(bootstrapSource, /function onEnhancedNavigationEnd\(\)[\s\S]*?behavior: "instant"[\s\S]*?syncScrollWorlds\(\)/);
  assert.doesNotMatch(bootstrapSource, /behavior: "auto"/);
});

test("project templates retain performance and crawlability defaults", () => {
  assert.match(configTemplate, /wheelMultiplier: 1/);
  assert.match(configTemplate, /wheelResponse: 18/);
  assert.match(configTemplate, /navigationDuration: 1800/);
  assert.match(configTemplate, /mountedWorlds/);
  assert.match(configTemplate, /isConnected/);
  assert.match(homeTemplate, /data-scroll-world-first-picture/);
  assert.match(homeTemplate, /fetchpriority="high"/);
  assert.match(homeTemplate, /<h1>/);
  assert.match(homeTemplate, /\/services\//);
  assert.match(homeTemplate, /\/contact/);
});

test("contact template is InteractiveAuto, validated, and demo-safe", async () => {
  const contactTemplate = await read("assets/blazor/Contact.razor.template");
  assert.match(contactTemplate, /@rendermode InteractiveAuto/);
  assert.match(contactTemplate, /DataAnnotationsValidator/);
  assert.match(contactTemplate, /disabled="@\(!IsInteractive\)"/);
  assert.match(contactTemplate, /Nothing is sent or stored/);
  assert.match(contactTemplate, /role="status" aria-live="polite"/);
  assert.match(contactTemplate, /intentionally sends and stores nothing/);
});

test("paid video generation is one-at-a-time and approval-gated", async () => {
  const pipeline = await read("references/pipeline.md");
  const review = await read("references/review-workflow.md");
  assert.match(skillSource, /Generate exactly one candidate/);
  assert.match(skillSource, /thumbs-up\/approval or thumbs-down/);
  assert.match(skillSource, /Draft approval does not approve the production render/);
  assert.match(pipeline, /Never launch a whole video loop/);
  assert.doesNotMatch(pipeline, /for n in \$NAMES; do gen_dive/);
  assert.doesNotMatch(pipeline, /gen_conn .* &/);
  assert.match(review, /Silence, elapsed time, or a technically valid render is never approval/);
  assert.match(review, /approval-ledger\.md/);
  assert.match(review, /every downstream leg is invalid/);
  assert.match(review, /Desktop approval never carries over to\s+portrait/);
});

test("quality choices cover live production resolution paths", () => {
  assert.match(skillSource, /seedance_2_0_mini`, 480p or 720p/);
  assert.match(skillSource, /seedance_2_0`, Fast, 480p or 720p/);
  assert.match(skillSource, /seedance_2_0`, Standard, 1080p/);
  assert.match(skillSource, /seedance_2_0`, Standard, 4K/);
  assert.match(skillSource, /Standard\/Pro\/4K mode/);
  assert.match(skillSource, /Disable\s+generated audio/);
  assert.match(skillSource, /gpt_image_2`: 1K\/2K\/4K/);
  assert.match(skillSource, /nano_banana_2/);
  assert.match(skillSource, /Never mix still models/);
});
