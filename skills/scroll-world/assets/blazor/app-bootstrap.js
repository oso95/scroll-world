import { syncScrollWorlds, unmountScrollWorlds } from "./scrollWorld/index.js";

export * as scrollWorld from "./scrollWorld/index.js";

let enhancedNavigationInProgress = false;

function onEnhancedNavigationStart() {
  enhancedNavigationInProgress = true;
  unmountScrollWorlds();
}

function onEnhancedLoad() {
  if (enhancedNavigationInProgress) return;
  syncScrollWorlds();
}

function onEnhancedNavigationEnd() {
  globalThis.scrollTo({ top: 0, left: 0, behavior: "instant" });
  enhancedNavigationInProgress = false;
  syncScrollWorlds();
}

export function startBlazorWhenIdle() {
  const firstFrame = document.querySelector("[data-scroll-world-first-still]");
  if (firstFrame) return;

  const loadAndStart = () => {
    const script = document.createElement("script");
    script.src = "_framework/blazor.web.js";
    script.setAttribute("autostart", "false");
    script.addEventListener("load", async () => {
      await globalThis.Blazor.start();
      globalThis.Blazor.addEventListener("enhancednavigationstart", onEnhancedNavigationStart);
      globalThis.Blazor.addEventListener("enhancedload", onEnhancedLoad);
      globalThis.Blazor.addEventListener("enhancednavigationend", onEnhancedNavigationEnd);
    }, { once: true });
    document.body.appendChild(script);
  };

  const waitForIdle = () => {
    if ("requestIdleCallback" in globalThis) {
      globalThis.requestIdleCallback(loadAndStart, { timeout: 1500 });
    } else {
      globalThis.setTimeout(loadAndStart, 0);
    }
  };

  const waitForPaint = () => {
    globalThis.requestAnimationFrame(() => globalThis.requestAnimationFrame(waitForIdle));
  };

  if (document.readyState === "complete") {
    waitForPaint();
  } else {
    globalThis.addEventListener("load", waitForPaint, { once: true });
  }
}

if (document.readyState === "loading") {
  globalThis.addEventListener("DOMContentLoaded", startBlazorWhenIdle, { once: true });
} else {
  startBlazorWhenIdle();
}
