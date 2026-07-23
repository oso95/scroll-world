/* ============================================================================
   scroll-world — Blazor-first scroll-scrubbed camera-flight engine
   ----------------------------------------------------------------------------
   Vanilla JS, zero dependencies. It builds its visual DOM and injects namespaced
   CSS into the server-rendered Blazor homepage container. Its explicit disposer and
   demand-driven media lifecycle are required for Blazor enhanced navigation.

   USAGE
     mountScrollWorld(document.getElementById('world'), {
       brand: { name: 'Pearl & Co.', href: '#top' },
        diveScroll: 1.3,   // viewport-heights of scroll per dive clip
        connScroll: 0.9,   // ...per connector clip
        wheelMultiplier: 1, // scale desktop wheel travel without adding scroll stops
        navigationDuration: 1800, // top/right section navigation duration in milliseconds
        hint: 'scroll to fly in',
       nav: true,         // show the top section nav
       atmosphere: true,  // subtle gradient + drifting particles behind the clips
       sections: [
         { id, label, still, stillMobile, clip, clipMobile, accent,
           scroll: 1.6,   // optional per-section override of diveScroll — more scroll
                          // distance = a slower, longer dwell in this scene
           linger: 0.5,   // optional 0..1 — remaps time so the camera settles mid-scene
                          // (exactly where the copy peaks) and moves quicker at the
                          // edges. 0 = linear (default). Keep ≤ 0.6; 1 = full pause.
           focus: 0.5,    // optional 0..1 route-dot landing point within this section
           eyebrow, title, body, tags:[…],
           cta:{ primary:{label,href}, secondary:{label,href} } }, // last section only
         …
       ],
       connectors: [clipUrl, …],          // length = sections.length - 1 (nulls allowed)
       connectorsMobile: [clipUrl, …],    // optional lighter connectors for phones (same length)

   MOBILE (the clipMobile/connectorsMobile variants are the opt-in mobile version;
   the rest of the phone handling below is always on)
     The engine is phone-aware out of the box: on a coarse-pointer / ≤860px viewport it
       - loads `clipMobile` / `connectorsMobile` when provided (encode these smaller +
         tighter-GOP — seek cost on a phone decoder is dominated by frames-from-keyframe,
         so a 720p, -g 4 file scrubs far smoother than the 1080p desktop master; see
         pipeline.md). Falls back to the desktop `clip` if no mobile variant is given.
       - uses `stillMobile` as the scene poster when provided (pair it with native 9:16
         clipMobile renders so the poster matches the portrait video's first frame instead
         of flashing from a landscape crop). Chosen once at mount; a desktop resize into
         phone width keeps the desktop poster (clips still switch via isMobile()).
       - coalesces seeks (never issues a new currentTime while the decoder is still
         `seeking`) so fast flicks can't pile up and freeze the video.
       - keeps the still as a live poster until the clip actually paints its first frame,
         and primes each video (muted play→pause) on first touch — this is what stops iOS
         from showing a blank scene before the first seek.
       - drops the drifting particles and ignores URL-bar-only resizes (no scroll jump).
     Nothing here is required — a config with only `clip`/`connectors` still works on
     phones; the mobile variants just make it lighter and smoother.

   THEME (CSS custom properties; set on the container or :root to override)
     --sw-bg         page background (match your scene bg for seamless posters)
     --sw-ink        primary text
     --sw-ink-soft   secondary text
     --sw-accent     default accent (each section overrides via its `accent`)
     --sw-font-display / --sw-font-body

   REQUIREMENTS ON YOUR ASSETS
     - clips encoded native-res, crf~20, -g 8, +faststart, no audio (see pipeline.md)
     - connectors' endpoints are the neighbouring dives' ACTUAL frames (see SKILL Phase 4)
     - (optional) mobile variants at ~720p, -g 4 for smoother phone scrubbing
   The engine loads each clip as a Blob (always seekable) and scrubs currentTime; it does
   NOT depend on HTTP byte-range support.
   ========================================================================== */

function mediaTimeForTarget(currentTime, duration, target, epsilon = 0.025) {
  if (!Number.isFinite(duration) || duration <= 0) return null;
  const normalized = Math.min(0.999, Math.max(0, target));
  const nextTime = normalized * duration;
  return Math.abs(currentTime - nextTime) > epsilon ? nextTime : null;
}

function scaledWheelDelta(deltaY, deltaMode, viewportHeight, multiplier) {
  const unit = deltaMode === 1 ? 16 : deltaMode === 2 ? viewportHeight : 1;
  return deltaY * unit * multiplier;
}

function accumulatedWheelTarget(currentTarget, currentScroll, delta, maxScroll) {
  const start = Number.isFinite(currentTarget) ? currentTarget : currentScroll;
  return Math.min(maxScroll, Math.max(0, start + delta));
}

function smoothWheelPosition(current, target, elapsedMilliseconds, responseMilliseconds = 90) {
  if (Math.abs(target - current) <= 1) return target;
  const elapsed = Math.max(0, elapsedMilliseconds);
  const alpha = 1 - Math.exp(-elapsed / responseMilliseconds);
  return current + (target - current) * alpha;
}

function navigationScrollPosition(start, target, elapsed, duration) {
  const progress = Math.min(1, Math.max(0, elapsed / duration));
  const eased = progress < 0.5
    ? 4 * progress * progress * progress
    : 1 - Math.pow(-2 * progress + 2, 3) / 2;
  return start + (target - start) * eased;
}

function sectionNavigationTarget(start, end, focus = 0.5) {
  const normalizedFocus = Number.isFinite(focus) ? Math.min(1, Math.max(0, focus)) : 0.5;
  return start + (end - start) * normalizedFocus;
}

function sectionIndexForPosition(starts, position) {
  let index = 0;
  for (let i = 1; i < starts.length; i++) {
    if (position < starts[i]) break;
    index = i;
  }
  return index;
}

function mountScrollWorld(container, config) {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Phone detection. `coarse` is captured once (input type doesn't change mid-session);
  // the ≤860px query is read live via isMobile() so a desktop resize/DevTools toggle
  // switches sources and seek behaviour without a reload.
  const coarse = window.matchMedia('(hover: none) and (pointer: coarse)').matches;
  const smallMQ = window.matchMedia('(max-width: 860px)');
  const isMobile = () => coarse || smallMQ.matches;
  const SECTIONS = config.sections || [];
  const CONNECTORS = config.connectors || [];
  const CONNECTORS_M = config.connectorsMobile || [];
  const NAV_LINKS = config.navLinks || [];
  const DIVE_W = config.diveScroll || 1.3;
  const CONN_W = config.connScroll || 0.9;
  const CROSSFADE = (config.crossfade != null) ? config.crossfade : 0.12;  // seam dissolve width (vh)
  const WHEEL_MULTIPLIER = config.wheelMultiplier || 1;
  const WHEEL_RESPONSE = config.wheelResponse || 90;
  const NAVIGATION_DURATION = config.navigationDuration || 1800;
  const N = SECTIONS.length;
  if (!N) return () => {};

  injectCSS();
  container.classList.add('sw-root');

  // ---- build the interleaved segment chain: dive0, conn0, dive1, … diveN-1 ----
  const SEGMENTS = [];
  SECTIONS.forEach((s, i) => {
    const dive = { kind: 'dive', si: i, clip: s.clip, clipM: s.clipMobile, still: s.still, stillM: s.stillMobile,
                   accent: s.accent, w: s.scroll || DIVE_W, linger: s.linger || 0 };
    SEGMENTS.push(dive);
    s._seg = dive;
    // A connector is optional: if connectors[i] is falsy, the two dives simply
    // crossfade directly (no fly-over). Lets a page complete even when a
    // connector can't be generated (e.g. a content-filter false-positive).
    if (i < N - 1 && CONNECTORS[i]) {
      SEGMENTS.push({ kind: 'conn', si: i, clip: CONNECTORS[i], clipM: CONNECTORS_M[i],
                      still: SECTIONS[i + 1].still, stillM: SECTIONS[i + 1].stillMobile,
                      accent: SECTIONS[i + 1].accent, w: CONN_W });
    }
  });
  const NSEG = SEGMENTS.length;

  // ---- DOM ----
  const sky = el('div', 'sw-sky');
  if (config.atmosphere !== false) {
    sky.appendChild(el('div', 'sw-sky__grad'));
    sky.appendChild(el('div', 'sw-sky__glow'));
  }
  const particles = el('div', 'sw-particles'); sky.appendChild(particles);

  const scrollbar = el('div', 'sw-scrollbar');
  const scrollbarFill = el('span'); scrollbar.appendChild(scrollbarFill);

  const topbar = el('div', 'sw-topbar');
  if (config.brand) {
    const brand = el('a', 'sw-brand'); brand.href = (config.brand.href || '#');
    brand.appendChild(el('span', 'sw-brand__mark'));
    const nm = el('span', 'sw-brand__name'); nm.textContent = config.brand.name || ''; brand.appendChild(nm);
    topbar.appendChild(brand);
  }
  const nav = el('nav', 'sw-nav'); if (config.nav !== false) topbar.appendChild(nav);
  if (config.cta && config.cta.label) {
    const c = el('a', 'sw-topcta'); c.href = config.cta.href || '#'; c.textContent = config.cta.label;
    topbar.appendChild(c);
  }

  const stage = el('div', 'sw-stage');
  const copylayer = el('div', 'sw-copylayer');
  copylayer.setAttribute('aria-hidden', 'true');
  const route = el('div', 'sw-route');
  const hint = el('div', 'sw-hint');
  const hintText = el('span'); hintText.textContent = config.hint || 'scroll'; hint.appendChild(hintText);
  hint.appendChild(el('i'));
  const track = el('div', 'sw-track');
  const initialPicture = container.querySelector('[data-scroll-world-first-picture]');
  const initialFrame = initialPicture?.closest('[data-scroll-world-first-frame]');

  [sky, scrollbar, topbar, stage, copylayer, route, hint, track].forEach(n => container.appendChild(n));

  // segment scenes
  SEGMENTS.forEach((s, index) => {
    const scene = el('div', 'sw-scene'); scene.style.setProperty('--sw-accent', s.accent || '');
    const poster = (isMobile() && s.stillM) ? s.stillM : s.still;
    const useInitialPicture = index === 0 && initialPicture;
    const img = useInitialPicture
      ? initialPicture.querySelector('[data-scroll-world-first-still]')
      : el('img', 'sw-scene__still');

    img.classList.add('sw-scene__still');
    img.alt = '';
    img.decoding = 'async';
    img.loading = index === 0 ? 'eager' : 'lazy';

    if (useInitialPicture) {
      initialPicture.classList.add('sw-scene__picture');
      scene.appendChild(initialPicture);
      initialFrame?.remove();
    } else {
      if (poster) img.dataset.poster = poster;
      scene.appendChild(img);
    }

    stage.appendChild(scene);
    s.el = scene; s.img = img; s.video = null; s.hasClip = false;
    s.poster = poster;
    s.loading = false; s.ready = false; s.loadPromise = null; s.abortController = null;
    s.target = 0; s.visible = false;
  });

  // per-section copy / route / nav
  const copies = [], dots = [];
  SECTIONS.forEach((s, i) => {
    const c = el('article', 'sw-copy'); c.style.setProperty('--sw-accent', s.accent || '');
    c.innerHTML =
      `<span class="sw-copy__num">${pad(i + 1)} / ${pad(N)}</span>` +
      (s.eyebrow ? `<span class="sw-copy__eyebrow">${esc(s.eyebrow)}</span>` : '') +
      (s.title ? `<h2 class="sw-copy__title">${esc(s.title)}</h2>` : '') +
      (s.body ? `<p class="sw-copy__body">${esc(s.body)}</p>` : '') +
      (s.tags && s.tags.length ? `<ul class="sw-copy__tags">${s.tags.map(t => `<li>${esc(t)}</li>`).join('')}</ul>` : '') +
      (s.cta ? `<div class="sw-copy__cta">${ctaBtns(s.cta)}</div>` : '');
    copylayer.appendChild(c); copies.push(c);

    const dot = el('button', 'sw-route__dot'); dot.style.setProperty('--sw-accent', s.accent || '');
    dot.innerHTML = `<span class="sw-route__label">${esc(s.label || '')}</span><i></i>`;
    dot.addEventListener('click', () => jumpTo(i)); route.appendChild(dot); dots.push(dot);

    if (config.nav !== false && !NAV_LINKS.length) {
      const b = el('button', 'sw-nav__item'); b.textContent = s.label || '';
      b.dataset.sectionNav = '';
      b.addEventListener('click', () => jumpTo(i)); nav.appendChild(b);
    }
  });

  if (config.nav !== false && NAV_LINKS.length) {
    NAV_LINKS.forEach(link => {
      const a = el('a', 'sw-nav__item');
      a.href = link.href || '#';
      a.textContent = link.label || '';
      nav.appendChild(a);
    });
  }

  // ---- math ----
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const smooth = x => { x = clamp(x); return x * x * (3 - 2 * x); };
  // Per-section dwell: monotone remap of scroll→time so the camera settles mid-scene
  // (where the copy peaks) and moves quicker near the seams. L=0 linear, L=1 full
  // mid-scene pause. f(0)=0, f(1)=1 always, so seam frames are untouched.
  const lingerEase = (x, L) => { L = clamp(L); const c = x - 0.5; return (1 - L) * x + L * (4 * c * c * c + 0.5); };
  let vh = window.innerHeight, stageX = 0, totalW = 0, activeIndex = -1, ticking = false;
  let laidOutW = window.innerWidth;   // width the current layout was computed at (see onResize)
  let navigationFrame = null;
  let wheelFrame = null;
  let wheelTarget = null;
  let previousWheelFrameTime = null;
  let scrollFrame = null;
  let scrubFrame = null;
  let disposed = false;

  function layout() {
    vh = window.innerHeight;
    laidOutW = window.innerWidth;
    stageX = window.innerWidth > 860 ? 4 : 0;
    let off = 0;
    SEGMENTS.forEach(s => { s.start = off * vh; off += s.w; s.end = off * vh; });
    totalW = off;
    track.style.height = (totalW * vh + vh) + 'px';   // +1vh so the last flight completes
    read();
  }

  function jumpTo(i) {
    const section = SECTIONS[i];
    const seg = section._seg;
    const target = sectionNavigationTarget(seg.start, seg.end, section.focus);
    cancelWheelScroll();
    cancelNavigation();
    if (reduce) {
      window.scrollTo({ top: target, behavior: 'auto' });
      return;
    }

    const start = window.scrollY || window.pageYOffset;
    const started = performance.now();
    const step = now => {
      const elapsed = now - started;
      window.scrollTo({ top: navigationScrollPosition(start, target, elapsed, NAVIGATION_DURATION), behavior: 'auto' });
      if (elapsed < NAVIGATION_DURATION) navigationFrame = requestAnimationFrame(step);
      else navigationFrame = null;
    };
    navigationFrame = requestAnimationFrame(step);
  }

  function cancelNavigation() {
    if (navigationFrame == null) return;
    cancelAnimationFrame(navigationFrame);
    navigationFrame = null;
  }

  function cancelWheelScroll() {
    if (wheelFrame != null) cancelAnimationFrame(wheelFrame);
    wheelFrame = null;
    wheelTarget = null;
    previousWheelFrameTime = null;
  }

  function ensurePoster(s) {
    if (!s.img || s.img.getAttribute('src') || !s.poster) return;
    s.img.src = s.poster;
    delete s.img.dataset.poster;
  }

  function waitForPoster(s) {
    ensurePoster(s);
    if (!s.img || s.img.complete) return Promise.resolve();

    return new Promise(resolve => {
      s.img.addEventListener('load', resolve, { once: true });
      s.img.addEventListener('error', resolve, { once: true });
    });
  }

  function animateWheelScroll(now) {
    const current = window.scrollY || window.pageYOffset;
    const target = wheelTarget ?? current;
    const remaining = target - current;

    if (Math.abs(remaining) < 0.5) {
      window.scrollTo({ top: target, behavior: 'auto' });
      wheelFrame = null;
      wheelTarget = null;
      previousWheelFrameTime = null;
      return;
    }

    const elapsed = previousWheelFrameTime == null ? 1000 / 60 : Math.min(32, now - previousWheelFrameTime);
    previousWheelFrameTime = now;
    window.scrollTo({ top: smoothWheelPosition(current, target, elapsed, WHEEL_RESPONSE), behavior: 'auto' });
    wheelFrame = requestAnimationFrame(animateWheelScroll);
  }

  function queueWheelScroll(delta) {
    const current = window.scrollY || window.pageYOffset;
    const maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    wheelTarget = accumulatedWheelTarget(wheelTarget, current, delta, maxScroll);
    if (wheelFrame == null) wheelFrame = requestAnimationFrame(animateWheelScroll);
  }

  function loadClip(s) {
    // Under prefers-reduced-motion we never load the clips at all — the stills stay up
    // and simply cross-dissolve as you scroll. No scrubbed video motion, no decode cost.
    if (reduce || !s.clip) return Promise.resolve(false);
    if (s.ready && s.video) return Promise.resolve(true);
    if (s.loadPromise) return s.loadPromise;
    s.loading = true;
    // Serve the lighter mobile encode on phones when one was provided.
    const url = (isMobile() && s.clipM) ? s.clipM : s.clip;
    const controller = new AbortController();
    s.abortController = controller;
    s.loadPromise = (async () => {
      try {
        await waitForPoster(s);
        if (disposed || controller.signal.aborted) return false;
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) throw new Error('404');
        const blob = await response.blob();
        if (disposed || controller.signal.aborted) return false;
        return await new Promise(resolve => {
        const v = document.createElement('video');
        v.className = 'sw-scene__video';
        v.muted = true; v.playsInline = true; v.preload = 'auto';
        v.setAttribute('muted', ''); v.setAttribute('playsinline', '');
        v.addEventListener('loadedmetadata', () => { s.ready = true; read(); resolve(true); }, { once: true });
        v.addEventListener('error', () => resolve(false), { once: true });
        // Reveal the video (hide the still poster) only once a real frame has
        // painted — on iOS a seeked-but-never-played muted video stays blank, so
        // hiding the still on metadata alone would flash an empty scene.
        v.addEventListener('seeked', () => { s.el.classList.add('has-clip'); }, { once: true });
        v.addEventListener('seeked', scheduleScrub);
        v.addEventListener('playing', () => { s.el.classList.add('has-clip'); }, { once: true });
        v.addEventListener('loadeddata', () => {
          try { v.pause(); } catch (e) {}
          if (userReady) primeVideo(v);
        });
        s.el.appendChild(v); s.video = v; s.hasClip = true;
        s.objectUrl = URL.createObjectURL(blob);
        v.src = s.objectUrl;
        });
      } catch {
        return false;
      } finally {
        if (s.abortController === controller) {
          s.abortController = null;
          s.loading = false;
          if (!s.ready) s.loadPromise = null;
        }
      }
    })();
    return s.loadPromise;
  }

  function unloadClip(s) {
    if (s.abortController) s.abortController.abort();
    s.abortController = null;
    s.loadPromise = null;
    s.loading = false;
    s.ready = false;
    s.hasClip = false;
    s.el.classList.remove('has-clip');
    if (s.video) {
      try { s.video.pause(); } catch (e) {}
      s.video.removeAttribute('src');
      try { s.video.load(); } catch (e) {}
      s.video.remove();
      s.video = null;
    }
    if (s.objectUrl) {
      URL.revokeObjectURL(s.objectUrl);
      s.objectUrl = null;
    }
  }

  function read() {
    const y = window.scrollY || window.pageYOffset;
    const fade = CROSSFADE * vh;

    for (let i = 0; i < NSEG; i++) {
      const s = SEGMENTS[i];
      if (y > s.start - 1.6 * vh && y < s.end + 1.6 * vh) {
        ensurePoster(s);
        loadClip(s);
      } else if (y < s.start - 2.25 * vh || y > s.end + 2.25 * vh) {
        unloadClip(s);
      }
      const local = clamp((y - s.start) / (s.end - s.start), 0, 1);
      s.target = s.linger ? lingerEase(local, s.linger) : local;
      // Keep the outgoing segment fully painted while the incoming segment fades
      // over it. Stable stacking avoids the hard z-index flip that would otherwise
      // reveal endpoint drift as a visible pop. The same dissolve works in reverse.
      const op = i === 0
        ? (NSEG === 1 || y <= s.end + fade ? 1 : 0)
        : (y <= s.start ? 0 : (y < s.start + fade ? smooth((y - s.start) / fade) : (i === NSEG - 1 || y <= s.end + fade ? 1 : 0)));
      s.el.style.opacity = op; s.visible = op > 0.001;
      s.el.style.zIndex = String(100 + i);
      if (!s.hasClip || !s.ready) {
        const sc = reduce ? 1 : 1.03 + local * 0.14;
        s.img.style.transform = `translateX(${stageX - 2}vw) scale(${sc.toFixed(3)})`;
      }
    }

    const near = sectionIndexForPosition(SECTIONS.map(section => section._seg.start), y);
    if (near !== activeIndex) {
      activeIndex = near;
      copies.forEach((copy, k) => copy.classList.toggle('is-active', k === near));
      dots.forEach((d, k) => d.classList.toggle('is-active', k === near));
      nav.querySelectorAll('.sw-nav__item[data-section-nav]').forEach((n, k) => n.classList.toggle('is-active', k === near));
      container.style.setProperty('--sw-accent', SECTIONS[near].accent || '');
    }
    scrollbarFill.style.transform = `scaleX(${clamp(y / (totalW * vh))})`;
    hint.style.opacity = clamp(1 - y / (0.5 * vh));
    if (particles) particles.style.transform = `translate3d(0, ${-y * 0.05}px, 0)`;
    scheduleScrub();
    ticking = false;
    scrollFrame = null;
  }

  function scheduleScrub() {
    if (disposed || scrubFrame != null) return;
    scrubFrame = requestAnimationFrame(raf);
  }

  function raf() {
    scrubFrame = null;
    if (disposed) return;
    const eps = isMobile() ? 0.04 : 0.025;   // ignore sub-frame changes that only add decode work
    for (let i = 0; i < NSEG; i++) {
      const s = SEGMENTS[i];
      if (!s.visible || !s.hasClip || !s.ready || !s.video) continue;
      // Coalesce scroll updates while the decoder is busy. Once it is free, seek
      // directly to the newest target instead of walking there through serial seeks.
      if (s.video.seeking) continue;
      const t = mediaTimeForTarget(s.video.currentTime, s.video.duration, s.target, eps);
      if (t != null) { try { s.video.currentTime = t; } catch (e) {} }
    }
  }

  // iOS needs a user gesture before a muted video will decode/paint reliably. On the
  // first touch we prime every loaded clip (muted play→pause) so the first seek is
  // instant instead of showing a blank frame. `userReady` also makes freshly-loaded
  // clips prime themselves (see loadClip).
  let userReady = false;
  function primeVideo(v) {
    if (!isMobile() || !v) return;
    try { const p = v.play(); if (p && p.then) p.then(() => { try { v.pause(); } catch (e) {} }).catch(() => {}); }
    catch (e) {}
  }
  function onFirstGesture() {
    if (userReady) return;
    userReady = true;
    SEGMENTS.forEach(s => primeVideo(s.video));
  }
  window.addEventListener('pointerdown', onFirstGesture, { once: true, passive: true });
  window.addEventListener('touchstart', onFirstGesture, { once: true, passive: true });

  // Chrome's middle-button autoscroll owns document position until the button is
  // released. Stop any older animation from fighting it and restoring a stale target.
  function onPointerDown(event) {
    if (event.button !== 1) return;
    cancelNavigation();
    cancelWheelScroll();
  }
  window.addEventListener('pointerdown', onPointerDown, { passive: true });

  // Particles are a per-frame cost we can't afford alongside video scrubbing on a phone.
  seedParticles(particles, reduce || coarse);
  function onScroll() {
    if (!ticking) { ticking = true; scrollFrame = requestAnimationFrame(read); }
  }
  function onWheel(event) {
    if (isMobile() || event.ctrlKey || Math.abs(event.deltaY) < 1) return;
    event.preventDefault();
    cancelNavigation();
    const delta = scaledWheelDelta(event.deltaY, event.deltaMode, vh, WHEEL_MULTIPLIER);
    if (reduce) {
      cancelWheelScroll();
      window.scrollBy({ top: delta, behavior: 'auto' });
    } else {
      queueWheelScroll(delta);
    }
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('wheel', onWheel, { passive: false });
  // Mobile browsers fire `resize` every time the URL bar slides in/out. Re-running
  // layout() there rebuilds the track height and yanks the scroll position, so on
  // touch we ignore height-only changes and only relayout when the width actually
  // changes (rotation still comes through orientationchange). layout() records the
  // width it laid out at.
  function onResize() {
    if (coarse && window.innerWidth === laidOutW) return;
    layout();
  }
  window.addEventListener('resize', onResize);
  window.addEventListener('orientationchange', layout);
  window.addEventListener('load', layout);
  layout();

  // ---- helpers ----
  function el(tag, cls) { const n = document.createElement(tag); if (cls) n.className = cls; return n; }
  function pad(n) { return String(n).padStart(2, '0'); }
  function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
  function ctaBtns(cta) {
    let h = '';
    if (cta.primary) h += `<a class="sw-btn sw-btn--primary" tabindex="-1" href="${esc(cta.primary.href || '#')}">${esc(cta.primary.label)}</a>`;
    if (cta.secondary) h += `<a class="sw-btn sw-btn--ghost" tabindex="-1" href="${esc(cta.secondary.href || '#')}">${esc(cta.secondary.label)}</a>`;
    return h;
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    cancelNavigation();
    cancelWheelScroll();
    if (scrollFrame != null) cancelAnimationFrame(scrollFrame);
    if (scrubFrame != null) cancelAnimationFrame(scrubFrame);
    window.removeEventListener('pointerdown', onFirstGesture);
    window.removeEventListener('pointerdown', onPointerDown);
    window.removeEventListener('touchstart', onFirstGesture);
    window.removeEventListener('scroll', onScroll);
    window.removeEventListener('wheel', onWheel);
    window.removeEventListener('resize', onResize);
    window.removeEventListener('orientationchange', layout);
    window.removeEventListener('load', layout);
    SEGMENTS.forEach(unloadClip);
    container.classList.remove('sw-root');
  }

  return dispose;
}

function seedParticles(host, reduce) {
  if (!host || reduce) return;
  const kinds = ['dot', 'dot', 'ring'];
  const seeds = [7, 23, 41, 58, 71, 88, 12, 34, 52, 66, 83, 95, 18, 29, 47, 63, 77, 91, 5, 38, 55, 69, 82, 97];
  for (let k = 0; k < 20; k++) {
    const s = document.createElement('span');
    s.className = 'sw-pt sw-pt--' + kinds[k % kinds.length];
    s.style.left = seeds[k % seeds.length] + 'vw';
    s.style.top = ((seeds[(k * 3) % seeds.length] * 1.3) % 100) + 'vh';
    s.style.setProperty('--sw-sc', (0.5 + ((seeds[(k * 5) % seeds.length] % 60) / 60) * 1.1).toFixed(2));
    const dur = 14 + (seeds[(k * 7) % seeds.length] % 22);
    s.style.animationDuration = dur + 's';
    s.style.animationDelay = (-(seeds[(k * 2) % seeds.length] % dur)) + 's';
    host.appendChild(s);
  }
}

function injectCSS() {
  if (document.getElementById('sw-css')) return;
  const css = `
  .sw-root{--sw-bg:#F5EDE0;--sw-ink:#241d2b;--sw-ink-soft:#6a6072;--sw-accent:#8a7bb5;
    --sw-font-display:ui-rounded,"SF Pro Rounded","Segoe UI",system-ui,sans-serif;
    --sw-font-body:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,system-ui,sans-serif;
    color:var(--sw-ink);font-family:var(--sw-font-body);}
  html,body{margin:0;background:var(--sw-bg,#F5EDE0);overflow-x:hidden;}
  .sw-sky{position:fixed;inset:0;z-index:0;overflow:hidden;pointer-events:none;background:var(--sw-bg);}
  .sw-sky__grad{position:absolute;inset:-10%;background:linear-gradient(178deg,color-mix(in srgb,var(--sw-accent) 12%,var(--sw-bg)) 0%,var(--sw-bg) 55%,color-mix(in srgb,var(--sw-accent) 6%,var(--sw-bg)) 100%);}
  .sw-sky__glow{position:absolute;inset:0;background:radial-gradient(60% 42% at 74% 16%,color-mix(in srgb,var(--sw-accent) 22%,transparent),transparent 70%),radial-gradient(46% 34% at 50% 50%,color-mix(in srgb,#fff 45%,transparent),transparent 70%);}
  .sw-particles{position:absolute;inset:-6% -2%;will-change:transform;}
  .sw-pt{position:absolute;width:13px;height:13px;transform:scale(var(--sw-sc,1));opacity:0;animation:sw-drift linear infinite;}
  .sw-pt::before{content:"";position:absolute;inset:0;border-radius:50%;}
  .sw-pt--dot::before{background:radial-gradient(circle at 34% 30%,color-mix(in srgb,var(--sw-accent) 60%,#000),#000 82%);}
  .sw-pt--ring::before{background:transparent;border:2px solid color-mix(in srgb,var(--sw-accent) 55%,transparent);}
  @keyframes sw-drift{0%{opacity:0;transform:scale(var(--sw-sc)) translate(0,12vh) rotate(0)}12%{opacity:.5}88%{opacity:.45}100%{opacity:0;transform:scale(var(--sw-sc)) translate(4vw,-22vh) rotate(210deg)}}
  .sw-scrollbar{position:fixed;top:0;left:0;right:0;height:3px;z-index:60;background:color-mix(in srgb,var(--sw-accent) 14%,transparent);}
  .sw-scrollbar span{display:block;height:100%;width:100%;transform-origin:0 50%;transform:scaleX(0);background:var(--sw-accent);}
  .sw-topbar{position:fixed;top:0;left:0;right:0;z-index:50;display:flex;align-items:center;justify-content:space-between;gap:16px;padding:clamp(14px,2.4vw,26px) clamp(18px,5vw,64px);}
  .sw-brand{display:flex;align-items:center;gap:10px;text-decoration:none;color:var(--sw-ink);}
  .sw-brand__mark{width:24px;height:28px;border-radius:7px 7px 10px 10px;background:linear-gradient(160deg,var(--sw-accent),color-mix(in srgb,var(--sw-accent) 60%,#000));box-shadow:0 6px 14px color-mix(in srgb,var(--sw-accent) 40%,transparent);}
  .sw-brand__name{font-family:var(--sw-font-display);font-weight:700;font-size:1.1rem;}
  .sw-nav{display:flex;gap:4px;padding:5px;background:color-mix(in srgb,#fff 55%,transparent);backdrop-filter:blur(10px);border:1px solid color-mix(in srgb,var(--sw-accent) 16%,transparent);border-radius:999px;}
  .sw-nav__item{display:block;font:inherit;font-size:.82rem;color:var(--sw-ink-soft);border:0;background:transparent;cursor:pointer;padding:7px 14px;border-radius:999px;text-decoration:none;transition:color .25s,background .25s;}
  .sw-nav__item:hover{color:var(--sw-ink);} .sw-nav__item.is-active{color:#fff;background:var(--sw-accent);}
  .sw-topcta{text-decoration:none;font-weight:600;font-size:.9rem;color:#fff;background:var(--sw-ink);padding:10px 20px;border-radius:999px;white-space:nowrap;}
  .sw-stage{position:fixed;inset:0;z-index:10;pointer-events:none;}
  .sw-scene{position:absolute;inset:0;opacity:0;overflow:hidden;will-change:opacity;}
  .sw-scene__picture,.sw-scene__video,.sw-scene__still{position:absolute;inset:0;width:100%;height:100%;}
  .sw-scene__picture{display:block;}
  .sw-scene__video,.sw-scene__still{object-fit:cover;object-position:center 42%;}
  .sw-scene__still{will-change:transform;} .sw-scene.has-clip .sw-scene__still{opacity:0;} .sw-scene__video{z-index:1;}
  .sw-copylayer{position:fixed;inset:0;z-index:20;pointer-events:none;}
  .sw-copylayer::before{content:"";position:absolute;inset:0;width:min(58vw,780px);background:linear-gradient(90deg,var(--sw-bg) 0%,color-mix(in srgb,var(--sw-bg) 82%,transparent) 34%,color-mix(in srgb,var(--sw-bg) 40%,transparent) 62%,transparent 100%);}
  .sw-copy{position:absolute;left:clamp(18px,5vw,64px);top:50%;transform:translateY(-50%);width:min(42vw,460px);opacity:0;transition:opacity .16s ease;will-change:opacity;}
  .sw-copy.is-active{opacity:1;}
  .sw-copy__num{font-family:ui-monospace,Menlo,monospace;font-size:.74rem;letter-spacing:.12em;color:var(--sw-ink-soft);}
  .sw-copy__eyebrow{display:block;margin-top:18px;font-family:var(--sw-font-display);font-weight:700;font-size:.8rem;letter-spacing:.16em;text-transform:uppercase;color:var(--sw-accent);}
  .sw-copy__title{font-family:var(--sw-font-display);font-weight:700;color:var(--sw-ink);font-size:clamp(2rem,4.4vw,3.5rem);line-height:1.03;margin:12px 0 0;letter-spacing:-.01em;text-shadow:0 2px 20px color-mix(in srgb,var(--sw-bg) 70%,transparent);}
  .sw-copy__body{margin-top:18px;font-size:clamp(1rem,1.25vw,1.14rem);line-height:1.55;color:color-mix(in srgb,var(--sw-ink) 78%,var(--sw-ink-soft));max-width:40ch;text-shadow:0 1px 12px color-mix(in srgb,var(--sw-bg) 90%,transparent);}
  .sw-copy__tags{list-style:none;display:flex;flex-wrap:wrap;gap:8px;margin:24px 0 0;padding:0;}
  .sw-copy__tags li{font-size:.82rem;font-weight:600;color:color-mix(in srgb,var(--sw-accent) 70%,#000);padding:7px 14px;border-radius:999px;background:color-mix(in srgb,var(--sw-accent) 14%,#fff);border:1px solid color-mix(in srgb,var(--sw-accent) 30%,transparent);}
  .sw-copy__cta{display:flex;flex-wrap:wrap;gap:12px;margin-top:28px;pointer-events:auto;}
  .sw-copy:not(.is-active) .sw-copy__cta{pointer-events:none;}
  .sw-btn{text-decoration:none;font-weight:600;font-size:.95rem;padding:13px 24px;border-radius:999px;transition:transform .2s;}
  .sw-btn--primary{color:#fff;background:var(--sw-ink);} .sw-btn--primary:hover{transform:translateY(-2px);}
  .sw-btn--ghost{color:var(--sw-ink);border:1.5px solid color-mix(in srgb,var(--sw-ink) 25%,transparent);} .sw-btn--ghost:hover{transform:translateY(-2px);}
  .sw-route{position:fixed;right:clamp(14px,2.4vw,30px);top:50%;z-index:40;transform:translateY(-50%);display:flex;flex-direction:column;gap:22px;padding:18px 10px;}
  .sw-route::before{content:"";position:absolute;left:50%;top:22px;bottom:22px;width:2px;transform:translateX(-50%);background:var(--sw-accent);opacity:.28;}
  .sw-route__dot{position:relative;border:0;background:transparent;cursor:pointer;width:14px;height:14px;display:grid;place-items:center;}
  .sw-route__dot i{width:9px;height:9px;border-radius:50%;background:color-mix(in srgb,var(--sw-accent) 40%,transparent);transition:transform .3s,background .3s,box-shadow .3s;}
  .sw-route__dot:hover i{transform:scale(1.25);background:var(--sw-accent);}
  .sw-route__dot.is-active i{background:var(--sw-accent);transform:scale(1.4);box-shadow:0 0 0 5px color-mix(in srgb,var(--sw-accent) 22%,transparent);}
  .sw-route__label{position:absolute;right:24px;top:50%;transform:translateY(-50%) translateX(6px);white-space:nowrap;font-size:.78rem;font-weight:600;color:var(--sw-ink);background:color-mix(in srgb,#fff 85%,transparent);backdrop-filter:blur(6px);padding:5px 11px;border-radius:999px;opacity:0;pointer-events:none;transition:opacity .25s,transform .25s;border:1px solid color-mix(in srgb,var(--sw-accent) 14%,transparent);}
  .sw-route__dot:hover .sw-route__label,.sw-route__dot.is-active .sw-route__label{opacity:1;transform:translateY(-50%) translateX(0);}
  .sw-hint{position:fixed;left:50%;bottom:24px;z-index:30;transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;gap:8px;padding:10px 16px 12px;border:1px solid color-mix(in srgb,var(--sw-ink) 16%,transparent);border-radius:999px;background:color-mix(in srgb,#fff 86%,transparent);box-shadow:0 10px 32px color-mix(in srgb,var(--sw-ink) 18%,transparent),inset 0 1px 0 #fff;backdrop-filter:blur(12px);font-size:.78rem;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--sw-ink);transition:opacity .3s;}
  .sw-hint i{width:28px;height:40px;border-radius:15px;border:2px solid color-mix(in srgb,var(--sw-ink) 72%,transparent);background:color-mix(in srgb,#fff 62%,transparent);box-shadow:0 3px 10px color-mix(in srgb,var(--sw-ink) 12%,transparent);position:relative;}
  .sw-hint i::after{content:"";position:absolute;left:50%;top:7px;width:5px;height:9px;border-radius:3px;background:var(--sw-accent);box-shadow:0 0 0 3px color-mix(in srgb,var(--sw-accent) 16%,transparent);transform:translateX(-50%);animation:sw-wheel 1.45s ease-in-out infinite;}
  @keyframes sw-wheel{0%{opacity:.2;top:6px}35%{opacity:1}100%{opacity:0;top:22px}}
  .sw-track{position:relative;z-index:1;width:100%;pointer-events:none;}
  @media (max-width:860px){
    .sw-nav{display:none;}
    .sw-copylayer::before{width:100%;height:60%;top:auto;bottom:0;background:linear-gradient(0deg,var(--sw-bg) 8%,color-mix(in srgb,var(--sw-bg) 70%,transparent) 46%,transparent 100%);}
    /* Anchor copy to the bottom, clear of the home indicator / collapsing URL bar.
       dvh + env() are progressive: browsers that lack them keep the vh fallback line. */
    .sw-copy{left:clamp(18px,5vw,64px);right:clamp(18px,5vw,64px);top:auto;bottom:clamp(64px,14vh,120px);transform:none;width:auto;max-width:560px;}
    .sw-copy{bottom:calc(clamp(56px,12dvh,110px) + env(safe-area-inset-bottom));}
    .sw-copy__title{font-size:clamp(1.9rem,7.5vw,2.7rem);}
    .sw-copy__body{max-width:none;font-size:clamp(.98rem,3.6vw,1.1rem);} .sw-scene__video,.sw-scene__still{object-position:center 46%;}
    .sw-hint{bottom:calc(20px + env(safe-area-inset-bottom));}
    .sw-route{gap:16px;right:6px;} .sw-route__label{display:none;}
  }
  /* Portrait phones crop a 16:9 clip hard; keep the framing centred so the focal
     subject (which the camera dives toward) stays in view. */
  @media (max-width:860px) and (orientation:portrait){
    .sw-scene__video,.sw-scene__still{object-position:center 44%;}
  }
  /* Touch: give the route dots a finger-sized hit area without growing the visible dot. */
  @media (hover:none) and (pointer:coarse){
    .sw-route{padding:14px 6px;}
    .sw-route__dot{width:28px;height:28px;}
    .sw-btn{padding:15px 26px;}
  }
  @media (prefers-reduced-motion:reduce){ .sw-hint i::after{animation:none;} .sw-pt{display:none;} }
  `;
  // Wrap in a cascade layer so the page's own theme tokens (unlayered
  // :root / .sw-root { --sw-bg / --sw-ink / --sw-accent … }) always win over
  // these defaults, regardless of injection order. Enables clean dark themes.
  const style = document.createElement('style'); style.id = 'sw-css';
  style.textContent = '@layer sw {\n' + css + '\n}';
  document.head.appendChild(style);
}

export { accumulatedWheelTarget, mediaTimeForTarget, mountScrollWorld, navigationScrollPosition, scaledWheelDelta, sectionIndexForPosition, sectionNavigationTarget, smoothWheelPosition };
