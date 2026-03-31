# Slide Engine V3.1 Batch 2 — Animation System + Presentation Mode

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add CSS-based animation system (4 levels, per-slide overrides) and browse/present dual-mode navigation to the slide engine.

**Architecture:** Pure CSS animations (@keyframes + transitions) controlled by CSS variables, with JS handling mode switching and fragment reveal timing. Animation settings flow through the existing buildCSS → buildNavJS → outlineToHtml pipeline. No new dependencies.

**Tech Stack:** TypeScript, CSS animations, Zustand store, React (Next.js dashboard)

**Spec:** `docs/superpowers/specs/2026-03-28-slide-engine-v31-batch2-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `dashboard/src/stores/presentations-store.ts` | Modify | Add AnimationLevel, SlideAnimation types; extend SlideSettings + SlideDefinition; add 3 actions |
| `dashboard/src/lib/slide-animation-defaults.ts` | **Create** | ANIMATION_DEFAULTS table + getSlideAnimation() |
| `dashboard/src/lib/slide-engine-css.ts` | Modify | Animation CSS variables, @keyframes, fragment transitions, stagger, @media print |
| `dashboard/src/lib/slide-templates.ts` | Modify | Add data-entrance/data-fragment/data-speed attributes to slide HTML |
| `dashboard/src/lib/slide-engine-nav.ts` | Modify | Browse/present modes, progressive fragment reveal, bidirectional postMessage, fullscreen |
| `dashboard/src/lib/presentations-utils.ts` | Modify | Pass animation settings through pipeline, add present button for exported HTML |
| `dashboard/src/components/.../style-settings-panel.tsx` | Modify | Animation level selector + per-slide animation dropdowns |
| `dashboard/src/components/.../slide-preview.tsx` | Modify | Present button, PDF export, iframe message listener |

---

## Task 1: Types + Animation Defaults

**Files:**
- Modify: `dashboard/src/stores/presentations-store.ts` (lines 51-54, 85-89, 63-66)
- Create: `dashboard/src/lib/slide-animation-defaults.ts`

- [ ] **Step 1: Add AnimationLevel and SlideAnimation types to store**

In `presentations-store.ts`, add after the `CustomParams` interface (after line 49):

```typescript
export type AnimationLevel = "none" | "subtle" | "moderate" | "dynamic";

export interface SlideAnimation {
  entrance: "fade" | "slide-up" | "slide-left" | "zoom";
  fragmentStyle: "fade" | "slide-up" | "slide-left" | "flip";
  speed: "slow" | "normal" | "fast";
}
```

- [ ] **Step 2: Extend SlideSettings with animationLevel**

Change the `SlideSettings` interface (lines 51-54) from:

```typescript
export interface SlideSettings {
  cardStyle: "solid" | "glass";
  customParams: CustomParams;
}
```

To:

```typescript
export interface SlideSettings {
  cardStyle: "solid" | "glass";
  customParams: CustomParams;
  animationLevel: AnimationLevel;
}
```

Update `DEFAULT_SLIDE_SETTINGS` (lines 63-66) from:

```typescript
export const DEFAULT_SLIDE_SETTINGS: SlideSettings = {
  cardStyle: "solid",
  customParams: DEFAULT_CUSTOM_PARAMS,
};
```

To:

```typescript
export const DEFAULT_SLIDE_SETTINGS: SlideSettings = {
  cardStyle: "solid",
  customParams: DEFAULT_CUSTOM_PARAMS,
  animationLevel: "moderate",
};
```

- [ ] **Step 3: Add animation field to SlideDefinition**

Change `SlideDefinition` (lines 85-89) from:

```typescript
export interface SlideDefinition {
  id: string;
  order: number;
  content: SlideContent;
}
```

To:

```typescript
export interface SlideDefinition {
  id: string;
  order: number;
  content: SlideContent;
  animation?: SlideAnimation;
}
```

- [ ] **Step 4: Create slide-animation-defaults.ts**

Create `dashboard/src/lib/slide-animation-defaults.ts`:

```typescript
import type { SlideAnimation, SlideDefinition, SlideType } from "@/stores/presentations-store";

export const ANIMATION_DEFAULTS: Record<SlideType, SlideAnimation> = {
  cover:            { entrance: "zoom",       fragmentStyle: "fade",       speed: "normal" },
  "section-divider": { entrance: "slide-left", fragmentStyle: "fade",       speed: "normal" },
  content:          { entrance: "fade",       fragmentStyle: "slide-up",   speed: "normal" },
  "two-column":     { entrance: "fade",       fragmentStyle: "slide-left", speed: "normal" },
  dataviz:          { entrance: "fade",       fragmentStyle: "slide-up",   speed: "normal" },
  quote:            { entrance: "fade",       fragmentStyle: "fade",       speed: "slow"   },
  "story-cards":    { entrance: "fade",       fragmentStyle: "zoom",       speed: "normal" },
  closing:          { entrance: "fade",       fragmentStyle: "fade",       speed: "normal" },
};

export function getSlideAnimation(slide: SlideDefinition): SlideAnimation {
  return slide.animation ?? ANIMATION_DEFAULTS[slide.content.slideType];
}
```

- [ ] **Step 5: Verify build**

Run: `cd dashboard && npx next build --no-lint 2>&1 | tail -20`

Expected: Build succeeds (new types are compatible, new file has no consumers yet).

- [ ] **Step 6: Commit**

```bash
git add dashboard/src/stores/presentations-store.ts dashboard/src/lib/slide-animation-defaults.ts
git commit -m "feat(slide-engine): add animation types and defaults table"
```

---

## Task 2: Store Actions

**Files:**
- Modify: `dashboard/src/stores/presentations-store.ts` (store interface + implementation)

- [ ] **Step 1: Add action signatures to PresentationsState interface**

In the `PresentationsState` interface, in the "Slide Settings" section (after line 155 `resetCustomParams`), add:

```typescript
  setAnimationLevel: (level: AnimationLevel) => void;
  setSlideAnimation: (slideId: string, animation: Partial<SlideAnimation>) => void;
  resetSlideAnimation: (slideId: string) => void;
```

- [ ] **Step 2: Implement setAnimationLevel**

In the store implementation (inside the `create` call), add after the `resetCustomParams` implementation:

```typescript
      setAnimationLevel: (level) => {
        const session = get().getActiveSession();
        if (!session) return;
        set((state) => {
          const s = state.sessions.get(session.id);
          if (s) s.slideSettings.animationLevel = level;
        });
      },
```

- [ ] **Step 3: Implement setSlideAnimation**

```typescript
      setSlideAnimation: (slideId, animation) => {
        const session = get().getActiveSession();
        if (!session) return;
        set((state) => {
          const s = state.sessions.get(session.id);
          if (!s) return;
          const slide = s.outline.slides.find((sl) => sl.id === slideId);
          if (!slide) return;
          slide.animation = { ...ANIMATION_DEFAULTS[slide.content.slideType], ...slide.animation, ...animation };
        });
      },
```

Add the import at the top of the file:

```typescript
import { ANIMATION_DEFAULTS } from "@/lib/slide-animation-defaults";
```

- [ ] **Step 4: Implement resetSlideAnimation**

```typescript
      resetSlideAnimation: (slideId) => {
        const session = get().getActiveSession();
        if (!session) return;
        set((state) => {
          const s = state.sessions.get(session.id);
          if (!s) return;
          const slide = s.outline.slides.find((sl) => sl.id === slideId);
          if (slide) delete slide.animation;
        });
      },
```

- [ ] **Step 5: Verify build**

Run: `cd dashboard && npx next build --no-lint 2>&1 | tail -20`

Expected: Build succeeds.

- [ ] **Step 6: Commit**

```bash
git add dashboard/src/stores/presentations-store.ts
git commit -m "feat(slide-engine): add animation store actions"
```

---

## Task 3: CSS Animation System

**Files:**
- Modify: `dashboard/src/lib/slide-engine-css.ts` (buildCSS function)

This is the largest task. We add animation CSS variables, @keyframes, fragment transitions, stagger delays, and @media print.

- [ ] **Step 1: Import AnimationLevel type**

At the top of `slide-engine-css.ts`, update the import from the store (line 4):

```typescript
import type { CustomParams, SlideSettings, AnimationLevel } from "@/stores/presentations-store";
```

- [ ] **Step 2: Add buildAnimationCSS helper function**

Add this function before `buildCSS` (before line 185):

```typescript
function buildAnimationCSS(level: AnimationLevel): string {
  if (level === "none") return "";

  const config: Record<Exclude<AnimationLevel, "none">, { duration: number; translate: number; stagger: number; easing: string }> = {
    subtle:   { duration: 300, translate: 0,  stagger: 100, easing: "ease" },
    moderate: { duration: 400, translate: 8,  stagger: 150, easing: "ease" },
    dynamic:  { duration: 500, translate: 20, stagger: 200, easing: "cubic-bezier(0.16, 1, 0.3, 1)" },
  };

  const c = config[level];

  let css = `
/* Animation Variables */
:root {
  --anim-duration: ${c.duration}ms;
  --anim-translate: ${c.translate}px;
  --anim-stagger: ${c.stagger}ms;
  --anim-easing: ${c.easing};
}

/* Per-slide speed overrides */
[data-speed="slow"]  { --anim-duration: 600ms; --anim-stagger: 250ms; }
[data-speed="fast"]  { --anim-duration: 200ms; --anim-stagger: 80ms; }

/* Entrance keyframes */
@keyframes entrance-fade {
  from { opacity: 0; } to { opacity: 1; }
}
@keyframes entrance-slide-up {
  from { opacity: 0; transform: translateY(30px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes entrance-slide-left {
  from { opacity: 0; transform: translateX(-30px); }
  to { opacity: 1; transform: translateX(0); }
}
@keyframes entrance-zoom {
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
}

/* Entrance activation on active slide */
.slide.active[data-entrance="fade"] .slide-inner      { animation: entrance-fade var(--anim-duration) var(--anim-easing) both; }
.slide.active[data-entrance="slide-up"] .slide-inner   { animation: entrance-slide-up var(--anim-duration) var(--anim-easing) both; }
.slide.active[data-entrance="slide-left"] .slide-inner { animation: entrance-slide-left var(--anim-duration) var(--anim-easing) both; }
.slide.active[data-entrance="zoom"] .slide-inner       { animation: entrance-zoom var(--anim-duration) var(--anim-easing) both; }

/* Fragment hidden state */
.slide.active .fragment {
  opacity: 0;
  transition: opacity var(--anim-duration) var(--anim-easing),
              transform var(--anim-duration) var(--anim-easing);
}

/* Fragment visible state */
.slide.active .fragment.visible {
  opacity: 1 !important;
  transform: translateY(0) translateX(0) scale(1) rotateX(0deg) !important;
}

/* Fragment style: fade (default — opacity only) */
[data-fragment="fade"] .fragment { transform: none; }

/* Fragment style: slide-up */
[data-fragment="slide-up"] .fragment { transform: translateY(var(--anim-translate)); }

/* Fragment style: slide-left */
[data-fragment="slide-left"] .fragment { transform: translateX(calc(var(--anim-translate) * -1)); }

/* Fragment style: flip */
[data-fragment="flip"] .fragment {
  transform: perspective(400px) rotateX(10deg);
  transform-origin: top center;
}
`;

  // Stagger delays for nth-child (up to 20)
  for (let i = 1; i <= 20; i++) {
    const delay = i === 1 ? "0ms" : `calc(var(--anim-stagger) * ${i - 1})`;
    css += `.slide.active .fragment:nth-child(${i}) { transition-delay: ${delay}; }\n`;
  }

  return css;
}
```

- [ ] **Step 3: Add @media print CSS helper**

Add after `buildAnimationCSS`:

```typescript
function buildPrintCSS(): string {
  return `
@media print {
  .viewport { transform: none !important; overflow: visible !important; }
  .slide-deck { overflow: visible !important; }
  .slide {
    page-break-after: always;
    break-after: page;
    position: relative !important;
    display: block !important;
    width: 1280px !important;
    height: 720px !important;
    transform: none !important;
  }
  .slide .fragment { opacity: 1 !important; transform: none !important; transition: none !important; }
  .slide .slide-inner { animation: none !important; }
  .nav-bar, .nav-title, #progress-bar, #present-btn, #exit-btn, #fragment-progress { display: none !important; }
}
`;
}
```

- [ ] **Step 4: Wire into buildCSS**

In the `buildCSS` function, find where fragment CSS is currently generated. Around line 434 there should be something like:

```
/* fragments */\n.fragment { opacity: 1; transform: translateY(0); }\n
```

Replace it with a conditional:

```typescript
  const animLevel = settings?.animationLevel ?? "none";
  // Fragment base (for "none" level — always visible)
  if (animLevel === "none") {
    css += `\n/* fragments */\n.fragment { opacity: 1; transform: translateY(0); }\n`;
  }
  // Animation CSS
  css += buildAnimationCSS(animLevel);
  // Print CSS
  css += buildPrintCSS();
```

- [ ] **Step 5: Verify build**

Run: `cd dashboard && npx next build --no-lint 2>&1 | tail -20`

Expected: Build succeeds.

- [ ] **Step 6: Commit**

```bash
git add dashboard/src/lib/slide-engine-css.ts
git commit -m "feat(slide-engine): add animation CSS system with 4 levels + print styles"
```

---

## Task 4: Template Data Attributes

**Files:**
- Modify: `dashboard/src/lib/slide-templates.ts` (slideToHtml function + template functions)

- [ ] **Step 1: Update imports**

At the top of `slide-templates.ts`, add:

```typescript
import type { SlideAnimation } from "@/stores/presentations-store";
```

- [ ] **Step 2: Update TemplateFn type and TEMPLATES registry**

Change the TemplateFn type (line 274) and update all template function signatures to accept animation:

```typescript
type TemplateFn = (slide: SlideContent, index: number, total: number, animation?: SlideAnimation) => string;
```

Each render function in the TEMPLATES map already matches `(slide, index, total)` — they'll just ignore the extra param since they don't use it directly. The data attributes go on the outer wrapper which is built in `slideToHtml`.

- [ ] **Step 3: Update slideToHtml to accept and apply animation**

Change `slideToHtml` (lines 287-294). The function currently dispatches to a template and the template builds the outer `<div class="slide ...">` wrapper.

We need to change the approach: instead of each template building its own outer div, `slideToHtml` wraps the template output with animation data attributes.

However, looking at the templates, each one already includes the outer `<div class="slide ${type} ...">`. The cleanest change is to modify `slideToHtml` to accept animation and inject data attributes into the template output:

```typescript
export function slideToHtml(
  slide: SlideContent,
  index: number,
  total: number,
  animation?: SlideAnimation,
): string {
  const fn = TEMPLATES[slide.slideType];
  if (!fn) return `<div class="slide" data-index="${index}">Unknown type</div>`;
  let html = fn(slide, index, total);

  // Inject animation data attributes into the opening slide div
  if (animation) {
    html = html.replace(
      /^(<div class="slide[^"]*")/,
      `$1 data-entrance="${animation.entrance}" data-fragment="${animation.fragmentStyle}" data-speed="${animation.speed}"`,
    );
  }

  return html;
}
```

This regex finds the first `<div class="slide..."` and injects the data attributes. No template functions need to change.

- [ ] **Step 4: Verify build**

Run: `cd dashboard && npx next build --no-lint 2>&1 | tail -20`

Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add dashboard/src/lib/slide-templates.ts
git commit -m "feat(slide-engine): inject animation data attributes into slide HTML"
```

---

## Task 5: Navigation JS — Browse/Present Modes

**Files:**
- Modify: `dashboard/src/lib/slide-engine-nav.ts` (complete rewrite of buildNavJS)

This is a significant rewrite. The current 86-line nav JS becomes ~200 lines with mode handling.

- [ ] **Step 1: Rewrite buildNavJS**

Replace the entire content of `slide-engine-nav.ts` with:

```typescript
/**
 * Generates inline JavaScript for slide navigation.
 * Supports browse mode (auto-reveal fragments) and present mode (manual fragment advance).
 */
export function buildNavJS(): string {
  return `
(function() {
  const slides = document.querySelectorAll('.slide');
  const total = slides.length;
  let current = 0;
  let mode = 'browse'; // 'browse' | 'present'

  /* ── Rescale ── */
  function rescale() {
    const vp = document.querySelector('.viewport');
    if (!vp) return;
    const sx = window.innerWidth / 1280;
    const sy = window.innerHeight / 720;
    const s = Math.min(sx, sy);
    vp.style.transform = 'scale(' + s + ')';
    vp.style.transformOrigin = 'top center';
  }
  window.addEventListener('resize', rescale);
  rescale();

  /* ── Fragments ── */
  function getFragments(slide) {
    return slide ? Array.from(slide.querySelectorAll('.fragment')) : [];
  }

  function revealAllFragments(slide) {
    getFragments(slide).forEach(function(f) { f.classList.add('visible'); });
  }

  function hideAllFragments(slide) {
    getFragments(slide).forEach(function(f) { f.classList.remove('visible'); });
  }

  function getVisibleCount(slide) {
    return slide ? slide.querySelectorAll('.fragment.visible').length : 0;
  }

  /* ── Show Slide ── */
  function showSlide(idx) {
    if (idx < 0 || idx >= total) return;
    slides.forEach(function(s, i) {
      s.classList.toggle('active', i === idx);
      s.style.display = i === idx ? 'flex' : 'none';
    });
    current = idx;

    var slide = slides[current];
    if (mode === 'browse') {
      revealAllFragments(slide);
    } else {
      hideAllFragments(slide);
    }

    updateUI();
    notifyParent({ slideChanged: current });
  }

  /* ── Present Mode: Advance Fragment ── */
  function advanceFragment() {
    var slide = slides[current];
    var hidden = slide.querySelectorAll('.fragment:not(.visible)');
    if (hidden.length > 0) {
      hidden[0].classList.add('visible');
      updateUI();
    } else {
      // All fragments visible — go to next slide
      if (current < total - 1) showSlide(current + 1);
    }
  }

  function retreatFragment() {
    var slide = slides[current];
    var visible = Array.from(slide.querySelectorAll('.fragment.visible'));
    if (visible.length > 0) {
      visible[visible.length - 1].classList.remove('visible');
      updateUI();
    } else {
      // No visible fragments — go to previous slide (all revealed)
      if (current > 0) {
        showSlide(current - 1);
        revealAllFragments(slides[current]);
        updateUI();
      }
    }
  }

  /* ── Navigation ── */
  function nextSlide() { if (current < total - 1) showSlide(current + 1); }
  function prevSlide() { if (current > 0) showSlide(current - 1); }

  /* ── UI Update ── */
  function updateUI() {
    var counter = document.getElementById('page-counter');
    if (counter) counter.textContent = (current + 1) + ' / ' + total;

    var bar = document.getElementById('progress-bar');
    if (bar) bar.style.width = ((current + 1) / total * 100) + '%';

    // Fragment progress (present mode only)
    var fp = document.getElementById('fragment-progress');
    if (fp) {
      if (mode === 'present') {
        var frags = getFragments(slides[current]);
        var vis = getVisibleCount(slides[current]);
        if (frags.length > 0) {
          var dots = frags.map(function(_, i) { return i < vis ? '●' : '○'; }).join(' ');
          fp.textContent = dots + ' (' + vis + '/' + frags.length + ')';
          fp.style.display = 'inline';
        } else {
          fp.style.display = 'none';
        }
      } else {
        fp.style.display = 'none';
      }
    }

    // Present/Exit buttons
    var presentBtn = document.getElementById('present-btn');
    var exitBtn = document.getElementById('exit-btn');
    if (presentBtn) presentBtn.style.display = mode === 'browse' ? 'inline-block' : 'none';
    if (exitBtn) exitBtn.style.display = mode === 'present' ? 'inline-block' : 'none';
  }

  /* ── Mode Switch ── */
  function enterPresent() {
    mode = 'present';
    hideAllFragments(slides[current]);
    updateUI();
    var el = document.documentElement;
    if (el.requestFullscreen) el.requestFullscreen();
  }

  function exitPresent() {
    mode = 'browse';
    revealAllFragments(slides[current]);
    updateUI();
    if (document.fullscreenElement) document.exitFullscreen();
  }

  // ESC / fullscreen exit → back to browse
  document.addEventListener('fullscreenchange', function() {
    if (!document.fullscreenElement && mode === 'present') {
      mode = 'browse';
      revealAllFragments(slides[current]);
      updateUI();
      notifyParent({ modeChanged: 'browse' });
    }
  });

  /* ── Parent Communication ── */
  function notifyParent(data) {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage(data, '*');
    }
  }

  window.addEventListener('message', function(e) {
    if (e.data && typeof e.data.goToSlide === 'number') {
      showSlide(e.data.goToSlide);
    }
    if (e.data && e.data.setMode === 'present') {
      enterPresent();
    }
    if (e.data && e.data.setMode === 'browse') {
      exitPresent();
    }
  });

  /* ── Keyboard ── */
  var debounce = 0;
  document.addEventListener('keydown', function(e) {
    var now = Date.now();
    if (now - debounce < 100) return;
    debounce = now;

    if (mode === 'present') {
      switch(e.key) {
        case 'ArrowRight': case 'ArrowDown': case ' ': case 'Enter': case 'PageDown':
          e.preventDefault();
          advanceFragment();
          break;
        case 'ArrowLeft': case 'ArrowUp': case 'PageUp': case 'Backspace':
          e.preventDefault();
          retreatFragment();
          break;
        case 'Escape':
          exitPresent();
          break;
      }
    } else {
      switch(e.key) {
        case 'ArrowRight': case 'ArrowDown': case ' ': case 'Enter': case 'PageDown':
          e.preventDefault();
          nextSlide();
          break;
        case 'ArrowLeft': case 'ArrowUp': case 'PageUp': case 'Backspace':
          e.preventDefault();
          prevSlide();
          break;
      }
    }
  });

  /* ── Button Handlers ── */
  var navPrev = document.getElementById('nav-prev');
  var navNext = document.getElementById('nav-next');
  if (navPrev) navPrev.addEventListener('click', function() {
    mode === 'present' ? retreatFragment() : prevSlide();
  });
  if (navNext) navNext.addEventListener('click', function() {
    mode === 'present' ? advanceFragment() : nextSlide();
  });

  var presentBtn = document.getElementById('present-btn');
  if (presentBtn) presentBtn.addEventListener('click', enterPresent);

  var exitBtn = document.getElementById('exit-btn');
  if (exitBtn) exitBtn.addEventListener('click', exitPresent);

  /* ── Expose for postMessage ── */
  window.__slideNav = { enterPresent: enterPresent, exitPresent: exitPresent };

  /* ── Init ── */
  showSlide(0);
})();
`;
}
```

- [ ] **Step 2: Verify build**

Run: `cd dashboard && npx next build --no-lint 2>&1 | tail -20`

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add dashboard/src/lib/slide-engine-nav.ts
git commit -m "feat(slide-engine): rewrite nav JS with browse/present modes + fragment control"
```

---

## Task 6: outlineToHtml Integration

**Files:**
- Modify: `dashboard/src/lib/presentations-utils.ts`

- [ ] **Step 1: Add imports**

Add to imports:

```typescript
import { getSlideAnimation } from "./slide-animation-defaults";
```

- [ ] **Step 2: Pass animation to slideToHtml**

In `outlineToHtml`, change the slides mapping (around lines 30-33) from:

```typescript
  const slidesHtml = sorted
    .map((s, i) => slideToHtml(s.content, i, sorted.length))
    .join("\n");
```

To:

```typescript
  const animLevel = settings?.animationLevel ?? "moderate";
  const slidesHtml = sorted
    .map((s, i) => {
      const anim = animLevel !== "none" ? getSlideAnimation(s) : undefined;
      return slideToHtml(s.content, i, sorted.length, anim);
    })
    .join("\n");
```

- [ ] **Step 3: Add present/exit buttons and fragment progress to nav HTML**

In the nav-bar HTML section (around lines 55-64), update to include the presentation mode buttons and fragment progress indicator. Find the nav-bar section and replace with:

```typescript
    <div class="nav-bar">
      <button id="nav-prev" aria-label="Previous">◀</button>
      <button id="nav-next" aria-label="Next">▶</button>
      <span id="page-counter">1 / ${sorted.length}</span>
      <span id="fragment-progress" style="display:none;margin-left:12px;font-size:13px;letter-spacing:2px"></span>
      <div style="flex:1"></div>
      <button id="present-btn" style="font-size:13px;padding:4px 12px;cursor:pointer;background:rgba(255,255,255,0.15);border:1px solid rgba(255,255,255,0.2);border-radius:4px;color:inherit">▶ 演示</button>
      <button id="exit-btn" style="display:none;font-size:13px;padding:4px 12px;cursor:pointer;background:rgba(255,0,0,0.2);border:1px solid rgba(255,255,255,0.2);border-radius:4px;color:inherit">✕ 退出</button>
    </div>
```

Also ensure the nav-bar has `display:flex;align-items:center;gap:8px` in its styling (check slide-engine-css.ts nav section).

- [ ] **Step 4: Pass settings to buildCSS**

Verify that `buildCSS(resolved, settings)` is already called with settings. It should be — this was done in Batch 1. Just confirm the call exists.

- [ ] **Step 5: Verify build**

Run: `cd dashboard && npx next build --no-lint 2>&1 | tail -20`

Expected: Build succeeds.

- [ ] **Step 6: Commit**

```bash
git add dashboard/src/lib/presentations-utils.ts
git commit -m "feat(slide-engine): wire animation settings through HTML pipeline + present buttons"
```

---

## Task 7: StyleSettingsPanel — Animation Controls

**Files:**
- Modify: `dashboard/src/components/skills/workstations/presentations/style-settings-panel.tsx`

- [ ] **Step 1: Add imports and store hooks**

Add to imports:

```typescript
import type { CustomParams, AnimationLevel, SlideAnimation } from "@/stores/presentations-store";
import { ANIMATION_DEFAULTS } from "@/lib/slide-animation-defaults";
```

In the `StyleSettingsPanel` component, add store hooks:

```typescript
  const setAnimationLevel = usePresentationsStore((s) => s.setAnimationLevel);
  const setSlideAnimation = usePresentationsStore((s) => s.setSlideAnimation);
  const resetSlideAnimation = usePresentationsStore((s) => s.resetSlideAnimation);
```

Extract animation state:

```typescript
  const animationLevel = session?.slideSettings.animationLevel ?? "moderate";
  const selectedSlideId = session?.selectedSlideId;
  const selectedSlide = session?.outline.slides.find((s) => s.id === selectedSlideId);
  const selectedAnimation = selectedSlide
    ? selectedSlide.animation ?? ANIMATION_DEFAULTS[selectedSlide.content.slideType]
    : null;
  const hasCustomAnimation = selectedSlide?.animation !== undefined;
```

- [ ] **Step 2: Add AnimationLevelSelector component**

Add a helper component inside the same file (before `StyleSettingsPanel`):

```typescript
const ANIM_LEVELS: { value: AnimationLevel; label: string }[] = [
  { value: "none", label: "無" },
  { value: "subtle", label: "輕微" },
  { value: "moderate", label: "適中" },
  { value: "dynamic", label: "豐富" },
];

function AnimationLevelSelector({
  value,
  onChange,
}: {
  value: AnimationLevel;
  onChange: (v: AnimationLevel) => void;
}) {
  return (
    <div className="flex gap-1">
      {ANIM_LEVELS.map((lvl) => (
        <button
          key={lvl.value}
          onClick={() => onChange(lvl.value)}
          className={`flex-1 px-2 py-1 text-xs rounded transition-colors ${
            value === lvl.value
              ? "bg-white/20 text-white font-medium"
              : "bg-white/5 text-white/50 hover:bg-white/10"
          }`}
        >
          {lvl.label}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Add SlideAnimationEditor component**

```typescript
const ENTRANCE_OPTIONS: { value: SlideAnimation["entrance"]; label: string }[] = [
  { value: "fade", label: "淡入" },
  { value: "slide-up", label: "上滑" },
  { value: "slide-left", label: "左滑" },
  { value: "zoom", label: "縮放" },
];

const FRAGMENT_OPTIONS: { value: SlideAnimation["fragmentStyle"]; label: string }[] = [
  { value: "fade", label: "淡入" },
  { value: "slide-up", label: "上滑" },
  { value: "slide-left", label: "左滑" },
  { value: "flip", label: "翻轉" },
];

const SPEED_OPTIONS: { value: SlideAnimation["speed"]; label: string }[] = [
  { value: "slow", label: "慢" },
  { value: "normal", label: "正常" },
  { value: "fast", label: "快" },
];

function AnimSelect<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-white/60">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="bg-white/10 text-white text-xs rounded px-2 py-1 border border-white/10"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}
```

- [ ] **Step 4: Add animation sections to StyleSettingsPanel JSX**

After the existing custom params sliders and before the reset button, add:

```tsx
      {/* Animation Level */}
      <div className="border-t border-white/10 pt-3 mt-3">
        <p className="text-xs text-white/60 mb-2">動畫強度</p>
        <AnimationLevelSelector value={animationLevel} onChange={setAnimationLevel} />
      </div>

      {/* Per-slide animation (only when a slide is selected and animation is not "none") */}
      {selectedSlideId && selectedAnimation && animationLevel !== "none" && (
        <div className="border-t border-white/10 pt-3 mt-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-white/60">
              選中 Slide 動畫
            </p>
            {hasCustomAnimation && (
              <button
                onClick={() => resetSlideAnimation(selectedSlideId)}
                className="text-[10px] text-white/40 hover:text-white/60"
              >
                ↺ 重設
              </button>
            )}
          </div>
          <div className="space-y-2">
            <AnimSelect
              label="進場效果"
              value={selectedAnimation.entrance}
              options={ENTRANCE_OPTIONS}
              onChange={(v) => setSlideAnimation(selectedSlideId, { entrance: v })}
            />
            <AnimSelect
              label="片段動畫"
              value={selectedAnimation.fragmentStyle}
              options={FRAGMENT_OPTIONS}
              onChange={(v) => setSlideAnimation(selectedSlideId, { fragmentStyle: v })}
            />
            <AnimSelect
              label="速度"
              value={selectedAnimation.speed}
              options={SPEED_OPTIONS}
              onChange={(v) => setSlideAnimation(selectedSlideId, { speed: v })}
            />
          </div>
        </div>
      )}

      {/* Disabled message when animation is none */}
      {selectedSlideId && animationLevel === "none" && (
        <div className="border-t border-white/10 pt-3 mt-3">
          <p className="text-xs text-white/40 italic">動畫已關閉</p>
        </div>
      )}
```

- [ ] **Step 5: Verify build**

Run: `cd dashboard && npx next build --no-lint 2>&1 | tail -20`

Expected: Build succeeds.

- [ ] **Step 6: Commit**

```bash
git add dashboard/src/components/skills/workstations/presentations/style-settings-panel.tsx
git commit -m "feat(slide-engine): add animation controls to StyleSettingsPanel"
```

---

## Task 8: SlidePreview — Present + PDF Buttons

**Files:**
- Modify: `dashboard/src/components/skills/workstations/presentations/slide-preview.tsx`

- [ ] **Step 1: Add present mode handler**

In the `SlidePreview` component, add a handler:

```typescript
  const handlePresent = () => {
    iframeRef.current?.contentWindow?.postMessage({ setMode: "present" }, "*");
  };
```

- [ ] **Step 2: Add PDF export handler**

```typescript
  const handleExportPDF = () => {
    iframeRef.current?.contentWindow?.print();
  };
```

- [ ] **Step 3: Add iframe message listener for reverse communication**

Add a useEffect to listen for messages from the iframe:

```typescript
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.slideChanged !== undefined && session) {
        const idx = e.data.slideChanged;
        const slide = session.outline.slides.find((s) => s.order === idx);
        if (slide) {
          usePresentationsStore.getState().setSelectedSlide(slide.id);
        }
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [session]);
```

- [ ] **Step 4: Add present and PDF buttons to toolbar**

In the toolbar JSX, add a "▶ 演示" button and "PDF" button alongside the existing export button. Add the `Presentation` and `FileText` (or `Printer`) icons to the lucide-react import:

Update import:
```typescript
import { Download, RotateCcw, Play, Printer } from "lucide-react";
```

Add buttons after the existing "匯出 HTML" button:

```tsx
        <button
          onClick={handleExportPDF}
          className="flex items-center gap-1 px-2 py-1 rounded text-xs bg-white/10 hover:bg-white/20 transition-colors"
          title="匯出 PDF（列印）"
        >
          <Printer size={14} />
          PDF
        </button>
        <button
          onClick={handlePresent}
          className="flex items-center gap-1 px-2 py-1 rounded text-xs bg-blue-600/80 hover:bg-blue-600 transition-colors text-white"
          title="進入演示模式"
        >
          <Play size={14} />
          演示
        </button>
```

- [ ] **Step 5: Add allowFullscreen to iframe**

Ensure the iframe element has the `allowFullScreen` attribute for fullscreen to work:

```tsx
<iframe
  ref={iframeRef}
  srcDoc={html}
  allowFullScreen
  // ... existing props
/>
```

- [ ] **Step 6: Verify build**

Run: `cd dashboard && npx next build --no-lint 2>&1 | tail -20`

Expected: Build succeeds.

- [ ] **Step 7: Commit**

```bash
git add dashboard/src/components/skills/workstations/presentations/slide-preview.tsx
git commit -m "feat(slide-engine): add present mode + PDF export to SlidePreview"
```

---

## Task 9: Nav CSS Tweaks

**Files:**
- Modify: `dashboard/src/lib/slide-engine-css.ts` (nav-bar styling)

The nav-bar CSS needs to accommodate the new buttons and fragment progress.

- [ ] **Step 1: Update nav-bar CSS in buildCSS**

Find the nav-bar styling section in `buildCSS` (around lines 444-451) and ensure it has flex layout:

```css
.nav-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: rgba(0,0,0,0.7);
  backdrop-filter: blur(8px);
  z-index: 100;
  font-size: 13px;
}
.nav-bar button {
  background: rgba(255,255,255,0.15);
  border: 1px solid rgba(255,255,255,0.2);
  color: inherit;
  padding: 4px 10px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
}
.nav-bar button:hover {
  background: rgba(255,255,255,0.25);
}
#fragment-progress {
  font-size: 12px;
  letter-spacing: 2px;
  opacity: 0.7;
}
```

- [ ] **Step 2: Verify build**

Run: `cd dashboard && npx next build --no-lint 2>&1 | tail -20`

- [ ] **Step 3: Commit**

```bash
git add dashboard/src/lib/slide-engine-css.ts
git commit -m "fix(slide-engine): update nav-bar CSS for present mode buttons"
```

---

## Task 10: Integration Verification

- [ ] **Step 1: Start dev server**

Run: `cd dashboard && npm run dev`

- [ ] **Step 2: Manual test checklist**

Open the presentations workstation, create/load a presentation, then verify:

1. **Animation Level**: StyleSettingsPanel shows 4-level selector → changing level regenerates preview
2. **Per-slide Animation**: Select a slide → see entrance/fragment/speed dropdowns → change values → preview updates
3. **animationLevel = "none"**: All fragments visible immediately, per-slide controls show "動畫已關閉"
4. **Present Mode**: Click "▶ 演示" → iframe goes fullscreen → fragments advance one at a time with arrow keys/space
5. **ESC exits**: Press ESC → exits fullscreen → returns to browse mode → all fragments visible
6. **Fragment Progress**: In present mode, see "● ○ ○ (1/3)" indicator
7. **HTML Export**: Download .html → open in browser → has present button → works standalone
8. **PDF Export**: Click PDF → print dialog opens → all slides visible, no UI elements, one per page
9. **Slide sync**: In present mode, changing slides sends slideChanged to parent → outline selection updates

- [ ] **Step 3: Take a screenshot for visual verification**

Use Playwright MCP to navigate to the workstation and take a screenshot.

- [ ] **Step 4: Final commit (if any fixes needed)**

```bash
git add -A
git commit -m "fix(slide-engine): integration fixes for Batch 2"
```
