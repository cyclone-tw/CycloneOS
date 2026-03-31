# Slide Engine V3.2 — Layout Control + Image Split Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add image split layouts, badge positioning, text alignment, and image source UI to the slide engine, plus fix fragment visibility and vertical whitespace bugs.

**Architecture:** Layout Modifier (data model) + Dedicated Image Panel (rendering). New `SlideLayout` type on `SlideContent` controls split mode. A `wrapWithLayout()` function wraps template output with grid containers. Badge and text alignment use CSS absolute positioning and data attributes respectively. Bug fixes address CSS fragment visibility and vertical centering.

**Tech Stack:** TypeScript, React, Zustand, CSS-in-JS (string templates), HTML generation

**Design Spec:** `docs/superpowers/specs/2026-03-28-slide-engine-v32-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `dashboard/src/stores/presentations-store.ts` | Modify | New types (`BadgePosition`, `TextAlign`, `SplitMode`, `SlideImage`, `SlideLayout`), extend `SlideContent`, add 5 store actions |
| `dashboard/src/lib/slide-templates.ts` | Modify | `wrapWithLayout()`, badge position class, `data-text-align` attribute |
| `dashboard/src/lib/slide-engine-css.ts` | Modify | Split layout CSS, badge position CSS, text align CSS, fragment fix, vertical centering fix |
| `dashboard/src/lib/slide-engine-nav.ts` | Modify | Add `body.present-mode` class toggling for CSS-based fragment visibility |
| `dashboard/src/lib/presentations-utils.ts` | Modify | Pass layout data through pipeline |
| `dashboard/src/components/skills/workstations/presentations/style-settings-panel.tsx` | Modify | Layout mode, image settings, badge grid, text align toggle |

---

## Batch 1: Foundation (Data Model + Bug Fixes)

### Task 1: Add new types and store actions

**Files:**
- Modify: `dashboard/src/stores/presentations-store.ts`

- [ ] **Step 1: Add new type definitions after existing types (after line 59)**

Add these types after the `SlideAnimation` interface (line 59):

```typescript
// --- V3.2: Layout Control + Image Split ---

export type BadgePosition =
  | "top-left" | "top-center" | "top-right"
  | "bottom-left" | "bottom-center" | "bottom-right";

export type TextAlign = "left" | "center" | "right";

export type SplitMode = "default" | "split-horizontal" | "split-vertical" | "image-overlay";

export interface SlideImage {
  url?: string;
  base64?: string;
  prompt?: string;
  overlay?: "dark" | "light" | "gradient";
  fit?: "cover" | "contain";
}

export interface SlideLayout {
  mode: SplitMode;
  imagePosition?: "left" | "right" | "top" | "bottom";
  splitRatio?: number;
  image?: SlideImage;
}
```

- [ ] **Step 2: Extend SlideContent interface (line 81-96)**

Replace the `SlideContent` interface with:

```typescript
export interface SlideContent {
  slideType: SlideType;
  variant: string;
  title?: string;
  subtitle?: string;
  body?: string;
  badge?: string;
  items?: ContentItem[];
  columns?: [ContentBlock, ContentBlock];
  quote?: { text: string; author?: string; source?: string };
  cards?: { title: string; body: string; icon?: string }[];
  bigNumber?: { value: string; label: string };
  stats?: { value: string; label: string }[];
  footnote?: string;
  backgroundImage?: BackgroundImage;
  layout?: SlideLayout;
  badgePosition?: BadgePosition;
  textAlign?: TextAlign;
}
```

- [ ] **Step 3: Add store action types to the interface (after line 172)**

Add these action declarations to the `PresentationsState` interface, after `resetSlideAnimation`:

```typescript
  // V3.2: Layout & position
  setSlideImageLayout: (slideId: string, layout: Partial<SlideLayout>) => void;
  setSlideImage: (slideId: string, image: SlideImage) => void;
  removeSlideImage: (slideId: string) => void;
  setBadgePosition: (slideId: string, position: BadgePosition) => void;
  setTextAlign: (slideId: string, align: TextAlign) => void;
```

- [ ] **Step 4: Implement store actions (after resetSlideAnimation implementation, ~line 472)**

Add these implementations after the `resetSlideAnimation` action:

```typescript
      setSlideImageLayout: (slideId, layout) =>
        set((state) => ({
          sessions: updateSession(state.sessions, state.activeSessionId, (s) => ({
            ...s,
            outline: {
              ...s.outline,
              slides: s.outline.slides.map((sl) =>
                sl.id === slideId
                  ? {
                      ...sl,
                      content: {
                        ...sl.content,
                        layout: { ...(sl.content.layout ?? { mode: "default" as SplitMode }), ...layout },
                      },
                    }
                  : sl
              ),
            },
          })),
        })),

      setSlideImage: (slideId, image) =>
        set((state) => ({
          sessions: updateSession(state.sessions, state.activeSessionId, (s) => ({
            ...s,
            outline: {
              ...s.outline,
              slides: s.outline.slides.map((sl) =>
                sl.id === slideId
                  ? {
                      ...sl,
                      content: {
                        ...sl.content,
                        layout: {
                          ...(sl.content.layout ?? { mode: "split-horizontal" as SplitMode }),
                          image,
                        },
                      },
                    }
                  : sl
              ),
            },
          })),
        })),

      removeSlideImage: (slideId) =>
        set((state) => ({
          sessions: updateSession(state.sessions, state.activeSessionId, (s) => ({
            ...s,
            outline: {
              ...s.outline,
              slides: s.outline.slides.map((sl) => {
                if (sl.id !== slideId) return sl;
                const { image: _, ...restLayout } = sl.content.layout ?? { mode: "default" as SplitMode };
                return {
                  ...sl,
                  content: { ...sl.content, layout: { ...restLayout, mode: "default" as SplitMode } },
                };
              }),
            },
          })),
        })),

      setBadgePosition: (slideId, position) =>
        set((state) => ({
          sessions: updateSession(state.sessions, state.activeSessionId, (s) => ({
            ...s,
            outline: {
              ...s.outline,
              slides: s.outline.slides.map((sl) =>
                sl.id === slideId
                  ? { ...sl, content: { ...sl.content, badgePosition: position } }
                  : sl
              ),
            },
          })),
        })),

      setTextAlign: (slideId, align) =>
        set((state) => ({
          sessions: updateSession(state.sessions, state.activeSessionId, (s) => ({
            ...s,
            outline: {
              ...s.outline,
              slides: s.outline.slides.map((sl) =>
                sl.id === slideId
                  ? { ...sl, content: { ...sl.content, textAlign: align } }
                  : sl
              ),
            },
          })),
        })),
```

- [ ] **Step 5: Verify TypeScript compiles**

Run: `cd dashboard && npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: No errors related to presentations-store.ts

- [ ] **Step 6: Commit**

```bash
git add dashboard/src/stores/presentations-store.ts
git commit -m "feat(slide-engine): add V3.2 data model — layout, badge position, text align types + store actions"
```

---

### Task 2: Fix fragment visibility in browse mode

**Problem:** Fragments have `opacity: 0` via animation CSS. The nav JS adds `.visible` class in browse mode, but there's a race condition. Fix by using CSS `body.present-mode` class to only hide fragments during presentation.

**Files:**
- Modify: `dashboard/src/lib/slide-engine-nav.ts`
- Modify: `dashboard/src/lib/slide-engine-css.ts`

- [ ] **Step 1: Add body class toggling in nav JS**

In `slide-engine-nav.ts`, in the `enterPresent` function, add `document.body.classList.add('present-mode')`:

Find in `buildNavJS()`:
```javascript
  function enterPresent() {
    mode = 'present';
    hideAllFragments(slides[current]);
```

Replace with:
```javascript
  function enterPresent() {
    mode = 'present';
    document.body.classList.add('present-mode');
    hideAllFragments(slides[current]);
```

In the `exitPresent` function, add `document.body.classList.remove('present-mode')`:

Find:
```javascript
  function exitPresent() {
    mode = 'browse';
    revealAllFragments(slides[current]);
```

Replace with:
```javascript
  function exitPresent() {
    mode = 'browse';
    document.body.classList.remove('present-mode');
    revealAllFragments(slides[current]);
```

In the fullscreenchange handler, add the same:

Find:
```javascript
      mode = 'browse';
      revealAllFragments(slides[current]);
      updateUI();
      notifyParent({ modeChanged: 'browse' });
```

Replace with:
```javascript
      mode = 'browse';
      document.body.classList.remove('present-mode');
      revealAllFragments(slides[current]);
      updateUI();
      notifyParent({ modeChanged: 'browse' });
```

- [ ] **Step 2: Fix animation CSS to use body.present-mode**

In `slide-engine-css.ts`, in the `buildAnimationCSS` function, change the fragment hidden state selector from `.slide.active .fragment` to `body.present-mode .slide.active .fragment`:

Find (around line 232-237):
```css
/* Fragment hidden state */
.slide.active .fragment {
  opacity: 0;
  transition: opacity var(--anim-duration) var(--anim-easing),
              transform var(--anim-duration) var(--anim-easing);
}
```

Replace with:
```css
/* Fragments visible by default (browse mode) */
.slide.active .fragment {
  opacity: 1;
  transition: opacity var(--anim-duration) var(--anim-easing),
              transform var(--anim-duration) var(--anim-easing);
}

/* Fragment hidden state (present mode only) */
body.present-mode .slide.active .fragment {
  opacity: 0;
}
```

- [ ] **Step 3: Also fix the fragment style transforms to be present-mode only**

Find the fragment style rules (around line 246-263):
```css
/* Fragment style: fade (default) */
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

/* Fragment style: zoom */
[data-fragment="zoom"] .fragment {
  transform: scale(0.85);
}
```

Replace with:
```css
/* Fragment style transforms (present mode only) */
body.present-mode [data-fragment="fade"] .fragment { transform: none; }
body.present-mode [data-fragment="slide-up"] .fragment { transform: translateY(var(--anim-translate)); }
body.present-mode [data-fragment="slide-left"] .fragment { transform: translateX(calc(var(--anim-translate) * -1)); }
body.present-mode [data-fragment="flip"] .fragment {
  transform: perspective(400px) rotateX(10deg);
  transform-origin: top center;
}
body.present-mode [data-fragment="zoom"] .fragment {
  transform: scale(0.85);
}
```

- [ ] **Step 4: Remove the animation-none fallback since fragments are now visible by default**

Find (around line 548-552):
```typescript
/* === Fragment (no hide — always visible when animation disabled) === */
${(() => {
  const animLevel = settings?.animationLevel ?? "none";
  return animLevel === "none" ? ".fragment { opacity: 1; transform: translateY(0); }" : "";
})()}
```

Replace with:
```typescript
/* === Fragment base (always visible in browse mode) === */
.fragment { opacity: 1; transform: none; }
```

- [ ] **Step 5: Verify TypeScript compiles**

Run: `cd dashboard && npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add dashboard/src/lib/slide-engine-nav.ts dashboard/src/lib/slide-engine-css.ts
git commit -m "fix(slide-engine): fix fragment visibility — visible by default, hidden only in present mode"
```

---

### Task 3: Fix vertical whitespace distribution

**Problem:** Content, dataviz, two-column, and story-cards slides have `justify-content: flex-start` + `padding-top: 56px`, causing content to cluster at top with large empty space at bottom.

**Files:**
- Modify: `dashboard/src/lib/slide-engine-css.ts`

- [ ] **Step 1: Fix content slide vertical centering**

Find (line 443):
```css
.content .slide-inner { justify-content: flex-start; padding-top: 56px; }
```

Replace with:
```css
.content .slide-inner { justify-content: center; }
```

- [ ] **Step 2: Fix two-column vertical centering**

Find (line 484):
```css
.two-column-inner { justify-content: flex-start; padding-top: 56px; }
```

Replace with:
```css
.two-column-inner { justify-content: center; }
```

- [ ] **Step 3: Fix dataviz vertical centering**

Find (line 492):
```css
.dataviz-inner { justify-content: flex-start; padding-top: 56px; }
```

Replace with:
```css
.dataviz-inner { justify-content: center; }
```

- [ ] **Step 4: Fix story-cards vertical centering**

Find (line 530):
```css
.story-cards-inner { justify-content: flex-start; padding-top: 56px; }
```

Replace with:
```css
.story-cards-inner { justify-content: center; }
```

- [ ] **Step 5: Verify TypeScript compiles**

Run: `cd dashboard && npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add dashboard/src/lib/slide-engine-css.ts
git commit -m "fix(slide-engine): fix vertical whitespace — center content vertically in all slide types"
```

---

## Batch 2: Badge Position + Text Alignment

### Task 4: Badge position (template + CSS)

**Files:**
- Modify: `dashboard/src/lib/slide-templates.ts`
- Modify: `dashboard/src/lib/slide-engine-css.ts`

- [ ] **Step 1: Update badge rendering in templates**

In `slide-templates.ts`, add a helper function after the existing helpers (after line 33):

```typescript
function badgeHtml(slide: SlideContent): string {
  if (!slide.badge) return "";
  const pos = slide.badgePosition ?? "top-center";
  return frag(`<div class="badge badge-${pos}">${esc(slide.badge)}</div>`);
}
```

- [ ] **Step 2: Replace badge rendering in all templates that use badges**

In `renderCover` (line 43), replace:
```typescript
    ${slide.badge ? frag(`<div class="badge">${esc(slide.badge)}</div>`) : ""}
```
with:
```typescript
    ${badgeHtml(slide)}
```

Do the same in any other template that renders badges. Currently only `renderCover` does, but the `badgeHtml` helper is available for any template.

- [ ] **Step 3: Add badge position CSS**

In `slide-engine-css.ts`, find the existing badge CSS (line 424):
```css
.slide .badge { font-size: ${scaledPx(12, params.badgeScale)}px; letter-spacing: ${scaledPx(3, params.badgeScale)}px; text-transform: uppercase; color: var(--slide-muted); margin-bottom: 20px; }
```

Replace with:
```css
.slide .badge { font-size: ${scaledPx(12, params.badgeScale)}px; letter-spacing: ${scaledPx(3, params.badgeScale)}px; text-transform: uppercase; color: var(--slide-muted); position: absolute; z-index: 2; }
.badge-top-left     { top: var(--slide-padding); left: var(--slide-padding); }
.badge-top-center   { top: var(--slide-padding); left: 50%; transform: translateX(-50%); }
.badge-top-right    { top: var(--slide-padding); right: var(--slide-padding); }
.badge-bottom-left  { bottom: var(--slide-padding); left: var(--slide-padding); }
.badge-bottom-center{ bottom: var(--slide-padding); left: 50%; transform: translateX(-50%); }
.badge-bottom-right { bottom: var(--slide-padding); right: var(--slide-padding); }
```

- [ ] **Step 4: Ensure slide-inner has position relative**

Check that `.slide-inner` already has `position: relative` (it does — line 414). The badge will be absolutely positioned relative to slide-inner. Confirmed.

- [ ] **Step 5: Verify TypeScript compiles**

Run: `cd dashboard && npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add dashboard/src/lib/slide-templates.ts dashboard/src/lib/slide-engine-css.ts
git commit -m "feat(slide-engine): add badge position control — 6 positions with absolute CSS positioning"
```

---

### Task 5: Text alignment (template + CSS)

**Files:**
- Modify: `dashboard/src/lib/slide-templates.ts`
- Modify: `dashboard/src/lib/slide-engine-css.ts`

- [ ] **Step 1: Add data-text-align attribute in slideToHtml**

In `slide-templates.ts`, in the `slideToHtml` function (line 287-304), add text align attribute injection:

Replace:
```typescript
export function slideToHtml(
  slide: SlideContent,
  index: number,
  total: number,
  animation?: SlideAnimation,
): string {
  const fn = TEMPLATES[slide.slideType] ?? TEMPLATES.content;
  let html = fn(slide, index, total);

  if (animation) {
    html = html.replace(
      /^(<div class="slide[^"]*")/,
      `$1 data-entrance="${animation.entrance}" data-fragment="${animation.fragmentStyle}" data-speed="${animation.speed}"`,
    );
  }

  return html;
}
```

With:
```typescript
export function slideToHtml(
  slide: SlideContent,
  index: number,
  total: number,
  animation?: SlideAnimation,
): string {
  const fn = TEMPLATES[slide.slideType] ?? TEMPLATES.content;
  let html = fn(slide, index, total);

  // Inject animation attributes
  if (animation) {
    html = html.replace(
      /^(<div class="slide[^"]*")/,
      `$1 data-entrance="${animation.entrance}" data-fragment="${animation.fragmentStyle}" data-speed="${animation.speed}"`,
    );
  }

  // Inject text alignment
  if (slide.textAlign && slide.textAlign !== "center") {
    html = html.replace(
      /^(<div class="slide[^"]*")/,
      `$1 data-text-align="${slide.textAlign}"`,
    );
  }

  return html;
}
```

- [ ] **Step 2: Add text alignment CSS**

In `slide-engine-css.ts`, add after the badge CSS (after the badge position rules added in Task 4):

```css
/* === Text Alignment (per-slide) === */
.slide[data-text-align="left"] .slide-inner { text-align: left; align-items: flex-start; }
.slide[data-text-align="left"] h1,
.slide[data-text-align="left"] h2 { text-align: left; }
.slide[data-text-align="right"] .slide-inner { text-align: right; align-items: flex-end; }
.slide[data-text-align="right"] h1,
.slide[data-text-align="right"] h2 { text-align: right; }
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd dashboard && npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add dashboard/src/lib/slide-templates.ts dashboard/src/lib/slide-engine-css.ts
git commit -m "feat(slide-engine): add per-slide text alignment — left/center/right via data attribute"
```

---

## Batch 3: Split Layout Engine

### Task 6: Split layout CSS

**Files:**
- Modify: `dashboard/src/lib/slide-engine-css.ts`

- [ ] **Step 1: Add split layout CSS**

In `slide-engine-css.ts`, add before the Navigation UI section (before line 562, the nav-bar rules). Add this CSS block:

```css
/* === Split Layout === */
.split-layout { display: grid; width: 100%; height: 100%; }
.split-layout.horizontal { grid-template-columns: 1fr 1fr; }
.split-layout.vertical { grid-template-rows: 1fr 1fr; }
.image-panel { overflow: hidden; position: relative; }
.image-panel img { width: 100%; height: 100%; object-fit: cover; display: block; }
.image-panel img.contain { object-fit: contain; }
.content-panel { display: flex; flex-direction: column; justify-content: center; overflow: hidden; }
.content-panel > .slide-inner { height: 100%; }
.split-layout[data-img-pos="left"] .image-panel { order: -1; }
.split-layout[data-img-pos="top"] .image-panel { order: -1; }

/* Overlay Layout */
.overlay-layout { position: relative; width: 100%; height: 100%; background-size: cover; background-position: center; }
.overlay-mask { position: absolute; inset: 0; z-index: 0; }
.overlay-mask.dark { background: rgba(0,0,0,0.55); }
.overlay-mask.light { background: rgba(255,255,255,0.4); }
.overlay-mask.gradient { background: linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 60%); }
.overlay-layout > .content-panel { position: relative; z-index: 1; height: 100%; }
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd dashboard && npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add dashboard/src/lib/slide-engine-css.ts
git commit -m "feat(slide-engine): add split layout + overlay CSS — grid-based image panels"
```

---

### Task 7: wrapWithLayout function + pipeline integration

**Files:**
- Modify: `dashboard/src/lib/slide-templates.ts`
- Modify: `dashboard/src/lib/presentations-utils.ts`

- [ ] **Step 1: Add import for SlideLayout type**

In `slide-templates.ts`, update the import (line 5):

```typescript
import type { SlideAnimation, SlideContent, SlideLayout, SlideType } from "@/stores/presentations-store";
```

- [ ] **Step 2: Add wrapWithLayout function**

In `slide-templates.ts`, add this function before the `slideToHtml` export (before line 287):

```typescript
function getImageSrc(image: SlideLayout["image"]): string {
  if (!image) return "";
  if (image.base64) return image.base64;
  if (image.url) return esc(image.url);
  return "";
}

function wrapWithLayout(html: string, layout?: SlideLayout): string {
  if (!layout || layout.mode === "default") return html;

  const image = layout.image;
  const src = getImageSrc(image);
  if (!src && layout.mode !== "image-overlay") return html;

  const fit = image?.fit ?? "cover";
  const fitClass = fit === "contain" ? ' class="contain"' : "";
  const imgTag = src ? `<img src="${src}"${fitClass} alt="" />` : "";

  if (layout.mode === "split-horizontal") {
    const ratio = layout.splitRatio ?? 50;
    const pos = layout.imagePosition ?? "right";
    const contentFr = 100 - ratio;
    // Grid: content first, image second (order swapped via data-img-pos)
    return `<div class="split-layout horizontal" data-img-pos="${pos}" style="grid-template-columns: ${contentFr}fr ${ratio}fr">
  <div class="content-panel">${html}</div>
  <div class="image-panel">${imgTag}</div>
</div>`;
  }

  if (layout.mode === "split-vertical") {
    const ratio = layout.splitRatio ?? 50;
    const pos = layout.imagePosition ?? "top";
    const contentFr = 100 - ratio;
    return `<div class="split-layout vertical" data-img-pos="${pos}" style="grid-template-rows: ${contentFr}fr ${ratio}fr">
  <div class="content-panel">${html}</div>
  <div class="image-panel">${imgTag}</div>
</div>`;
  }

  if (layout.mode === "image-overlay") {
    const overlay = image?.overlay ?? "dark";
    const bgSrc = src ? `background-image:url('${src}')` : "";
    return `<div class="overlay-layout" style="${bgSrc};background-size:cover;background-position:center">
  <div class="overlay-mask ${overlay}"></div>
  <div class="content-panel">${html}</div>
</div>`;
  }

  return html;
}
```

- [ ] **Step 3: Integrate wrapWithLayout into slideToHtml**

In the `slideToHtml` function, add the layout wrapping step. The function should look like:

```typescript
export function slideToHtml(
  slide: SlideContent,
  index: number,
  total: number,
  animation?: SlideAnimation,
): string {
  const fn = TEMPLATES[slide.slideType] ?? TEMPLATES.content;
  let html = fn(slide, index, total);

  // Inject animation attributes
  if (animation) {
    html = html.replace(
      /^(<div class="slide[^"]*")/,
      `$1 data-entrance="${animation.entrance}" data-fragment="${animation.fragmentStyle}" data-speed="${animation.speed}"`,
    );
  }

  // Inject text alignment
  if (slide.textAlign && slide.textAlign !== "center") {
    html = html.replace(
      /^(<div class="slide[^"]*")/,
      `$1 data-text-align="${slide.textAlign}"`,
    );
  }

  // Wrap with layout (split/overlay) — wraps the INNER content of the slide div
  if (slide.layout && slide.layout.mode !== "default") {
    // Extract slide-inner from the slide div and wrap it
    html = html.replace(
      /(<div class="slide[^>]*>)\s*([\s\S]*)\s*(<\/div>)\s*$/,
      (_, openTag, inner, closeTag) => `${openTag}\n${wrapWithLayout(inner.trim(), slide.layout)}\n${closeTag}`,
    );
  }

  return html;
}
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `cd dashboard && npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add dashboard/src/lib/slide-templates.ts dashboard/src/lib/presentations-utils.ts
git commit -m "feat(slide-engine): add wrapWithLayout — split horizontal/vertical + image overlay rendering"
```

---

## Batch 4: UI Controls

### Task 8: Badge position + Text alignment UI

**Files:**
- Modify: `dashboard/src/components/skills/workstations/presentations/style-settings-panel.tsx`

- [ ] **Step 1: Add imports for new store types and actions**

Update the imports at the top of `style-settings-panel.tsx`:

```typescript
import { RotateCcw } from "lucide-react";
import { usePresentationsStore } from "@/stores/presentations-store";
import type {
  CustomParams,
  AnimationLevel,
  SlideAnimation,
  BadgePosition,
  TextAlign,
} from "@/stores/presentations-store";
import { ANIMATION_DEFAULTS } from "@/lib/slide-animation-defaults";
```

- [ ] **Step 2: Add store hooks for new actions**

In the `StyleSettingsPanel` component, add these hooks after the existing ones (after line 43):

```typescript
  const setBadgePosition = usePresentationsStore((s) => s.setBadgePosition);
  const setTextAlign = usePresentationsStore((s) => s.setTextAlign);
```

- [ ] **Step 3: Add derived state for selected slide's badge and text align**

After the `hasCustomAnimation` line (line 54), add:

```typescript
  const selectedBadgePos = selectedSlide?.content.badgePosition ?? "top-center";
  const selectedTextAlign = selectedSlide?.content.textAlign ?? "center";
```

- [ ] **Step 4: Add Badge Position selector UI**

Add this section after the animation controls section, before the reset button (before line 212). Insert after the `animationLevel === "none"` disabled message block:

```tsx
      {/* Badge Position (per-slide) */}
      {selectedSlideId && (
        <div className="border-t border-cy-border/30 pt-3 mt-3">
          <span className="text-xs text-cy-muted mb-2 block">徽章位置</span>
          <div className="grid grid-cols-3 gap-1 w-fit">
            {(
              [
                { value: "top-left", label: "↖" },
                { value: "top-center", label: "↑" },
                { value: "top-right", label: "↗" },
                { value: "bottom-left", label: "↙" },
                { value: "bottom-center", label: "↓" },
                { value: "bottom-right", label: "↘" },
              ] as { value: BadgePosition; label: string }[]
            ).map((pos) => (
              <button
                key={pos.value}
                onClick={() => setBadgePosition(selectedSlideId, pos.value)}
                className={`w-8 h-8 text-xs rounded border transition-colors ${
                  selectedBadgePos === pos.value
                    ? "bg-cy-accent/20 text-cy-accent border-cy-accent/40"
                    : "text-cy-muted border-cy-border/30 hover:bg-cy-input/50"
                }`}
              >
                {pos.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Text Alignment (per-slide) */}
      {selectedSlideId && (
        <div className="border-t border-cy-border/30 pt-3 mt-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-cy-muted w-16 shrink-0">文字對齊</span>
            <div className="flex rounded-md overflow-hidden border border-cy-border/30">
              {(
                [
                  { value: "left", label: "左" },
                  { value: "center", label: "中" },
                  { value: "right", label: "右" },
                ] as { value: TextAlign; label: string }[]
              ).map((align) => (
                <button
                  key={align.value}
                  onClick={() => setTextAlign(selectedSlideId, align.value)}
                  className={`px-3 py-1 text-xs transition-colors ${
                    selectedTextAlign === align.value
                      ? "bg-cy-accent/20 text-cy-accent"
                      : "text-cy-muted hover:bg-cy-input/50"
                  }`}
                >
                  {align.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
```

- [ ] **Step 5: Verify TypeScript compiles**

Run: `cd dashboard && npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add dashboard/src/components/skills/workstations/presentations/style-settings-panel.tsx
git commit -m "feat(slide-engine): add badge position grid + text alignment toggle UI"
```

---

### Task 9: Layout mode + Image settings UI

**Files:**
- Modify: `dashboard/src/components/skills/workstations/presentations/style-settings-panel.tsx`

- [ ] **Step 1: Add store hooks for layout actions**

Add these hooks in the component (after the ones added in Task 8):

```typescript
  const setSlideImageLayout = usePresentationsStore((s) => s.setSlideImageLayout);
  const setSlideImage = usePresentationsStore((s) => s.setSlideImage);
  const removeSlideImage = usePresentationsStore((s) => s.removeSlideImage);
```

- [ ] **Step 2: Add derived state for layout**

After the `selectedTextAlign` line added in Task 8:

```typescript
  const selectedLayout = selectedSlide?.content.layout;
  const layoutMode = selectedLayout?.mode ?? "default";
  const layoutImage = selectedLayout?.image;
  const splitRatio = selectedLayout?.splitRatio ?? 50;
  const imagePosition = selectedLayout?.imagePosition ?? (layoutMode === "split-vertical" ? "top" : "right");
```

- [ ] **Step 3: Add image upload handler function**

Add this function inside the component, before the return statement:

```typescript
  function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !selectedSlideId) return;
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      setSlideImage(selectedSlideId, { base64 });
    };
    reader.readAsDataURL(file);
  }
```

- [ ] **Step 4: Add Layout Mode + Image Settings UI**

Add this section before the badge position section (inserted in Task 8). This goes after the animation disabled message and before the badge position block:

```tsx
      {/* Layout Mode (per-slide) */}
      {selectedSlideId && (
        <div className="border-t border-cy-border/30 pt-3 mt-3">
          <span className="text-xs text-cy-muted mb-2 block">佈局模式</span>
          <div className="flex rounded-md overflow-hidden border border-cy-border/30 mb-2">
            {(
              [
                { value: "default", label: "預設" },
                { value: "split-horizontal", label: "左右分割" },
                { value: "split-vertical", label: "上下分割" },
                { value: "image-overlay", label: "圖片覆蓋" },
              ] as { value: string; label: string }[]
            ).map((m) => (
              <button
                key={m.value}
                onClick={() =>
                  setSlideImageLayout(selectedSlideId, {
                    mode: m.value as "default" | "split-horizontal" | "split-vertical" | "image-overlay",
                  })
                }
                className={`px-2 py-1 text-xs transition-colors flex-1 ${
                  layoutMode === m.value
                    ? "bg-cy-accent/20 text-cy-accent"
                    : "text-cy-muted hover:bg-cy-input/50"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          {/* Image Settings — shown when not default */}
          {layoutMode !== "default" && (
            <div className="space-y-3 mt-3 p-3 rounded-lg bg-cy-input/20 border border-cy-border/20">
              <span className="text-xs text-cy-muted font-medium block">圖片設定</span>

              {/* URL Input */}
              <div>
                <label className="text-[10px] text-cy-muted block mb-1">圖片 URL</label>
                <input
                  type="text"
                  placeholder="https://images.unsplash.com/..."
                  value={layoutImage?.url ?? ""}
                  onChange={(e) =>
                    setSlideImage(selectedSlideId, {
                      ...layoutImage,
                      url: e.target.value,
                      base64: layoutImage?.base64,
                    })
                  }
                  className="w-full bg-cy-input/50 text-cy-text text-xs rounded px-2 py-1.5 border border-cy-border/30"
                />
              </div>

              {/* File Upload */}
              <div>
                <label className="text-[10px] text-cy-muted block mb-1">上傳圖片</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="w-full text-xs text-cy-muted file:mr-2 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:bg-cy-accent/20 file:text-cy-accent"
                />
              </div>

              {/* AI Generation Prompt */}
              <div>
                <label className="text-[10px] text-cy-muted block mb-1">AI 生成（描述想要的圖片）</label>
                <div className="flex gap-1">
                  <input
                    type="text"
                    placeholder="例：科技感的抽象背景，深藍色調"
                    value={layoutImage?.prompt ?? ""}
                    onChange={(e) =>
                      setSlideImage(selectedSlideId, {
                        ...layoutImage,
                        prompt: e.target.value,
                      })
                    }
                    className="flex-1 bg-cy-input/50 text-cy-text text-xs rounded px-2 py-1.5 border border-cy-border/30"
                  />
                  <button
                    onClick={() => {
                      /* TODO: integrate with Claude chat session to generate image */
                      alert("AI 圖片生成功能開發中");
                    }}
                    className="px-2 py-1.5 text-xs bg-cy-accent/20 text-cy-accent rounded border border-cy-accent/30 hover:bg-cy-accent/30 transition-colors shrink-0"
                  >
                    生成
                  </button>
                </div>
              </div>

              {/* Preview */}
              {(layoutImage?.base64 || layoutImage?.url) && (
                <div className="relative rounded overflow-hidden h-20 bg-cy-input/30">
                  <img
                    src={layoutImage.base64 || layoutImage.url}
                    alt="Preview"
                    className="w-full h-full object-cover"
                  />
                  <button
                    onClick={() => removeSlideImage(selectedSlideId)}
                    className="absolute top-1 right-1 w-5 h-5 rounded-full bg-red-500/80 text-white text-[10px] flex items-center justify-center hover:bg-red-600"
                  >
                    ✕
                  </button>
                </div>
              )}

              {/* Split Ratio — only for split modes */}
              {(layoutMode === "split-horizontal" || layoutMode === "split-vertical") && (
                <div className="flex items-center gap-3">
                  <span className="text-[10px] text-cy-muted w-14 shrink-0">圖片比例</span>
                  <input
                    type="range"
                    min={30}
                    max={70}
                    step={5}
                    value={splitRatio}
                    onChange={(e) =>
                      setSlideImageLayout(selectedSlideId, {
                        splitRatio: parseInt(e.target.value),
                      })
                    }
                    className="flex-1 h-1 accent-cy-accent"
                  />
                  <span className="text-[10px] text-cy-muted w-8 text-right tabular-nums">
                    {splitRatio}%
                  </span>
                </div>
              )}

              {/* Image Position */}
              {layoutMode === "split-horizontal" && (
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-cy-muted w-14 shrink-0">圖片位置</span>
                  <div className="flex rounded-md overflow-hidden border border-cy-border/30">
                    <button
                      onClick={() => setSlideImageLayout(selectedSlideId, { imagePosition: "left" })}
                      className={`px-2 py-1 text-[10px] transition-colors ${
                        imagePosition === "left" ? "bg-cy-accent/20 text-cy-accent" : "text-cy-muted hover:bg-cy-input/50"
                      }`}
                    >
                      左
                    </button>
                    <button
                      onClick={() => setSlideImageLayout(selectedSlideId, { imagePosition: "right" })}
                      className={`px-2 py-1 text-[10px] transition-colors ${
                        imagePosition === "right" ? "bg-cy-accent/20 text-cy-accent" : "text-cy-muted hover:bg-cy-input/50"
                      }`}
                    >
                      右
                    </button>
                  </div>
                </div>
              )}

              {layoutMode === "split-vertical" && (
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-cy-muted w-14 shrink-0">圖片位置</span>
                  <div className="flex rounded-md overflow-hidden border border-cy-border/30">
                    <button
                      onClick={() => setSlideImageLayout(selectedSlideId, { imagePosition: "top" })}
                      className={`px-2 py-1 text-[10px] transition-colors ${
                        imagePosition === "top" ? "bg-cy-accent/20 text-cy-accent" : "text-cy-muted hover:bg-cy-input/50"
                      }`}
                    >
                      上
                    </button>
                    <button
                      onClick={() => setSlideImageLayout(selectedSlideId, { imagePosition: "bottom" })}
                      className={`px-2 py-1 text-[10px] transition-colors ${
                        imagePosition === "bottom" ? "bg-cy-accent/20 text-cy-accent" : "text-cy-muted hover:bg-cy-input/50"
                      }`}
                    >
                      下
                    </button>
                  </div>
                </div>
              )}

              {/* Image Fit */}
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-cy-muted w-14 shrink-0">填充方式</span>
                <div className="flex rounded-md overflow-hidden border border-cy-border/30">
                  <button
                    onClick={() => setSlideImage(selectedSlideId, { ...layoutImage, fit: "cover" })}
                    className={`px-2 py-1 text-[10px] transition-colors ${
                      (layoutImage?.fit ?? "cover") === "cover" ? "bg-cy-accent/20 text-cy-accent" : "text-cy-muted hover:bg-cy-input/50"
                    }`}
                  >
                    填滿
                  </button>
                  <button
                    onClick={() => setSlideImage(selectedSlideId, { ...layoutImage, fit: "contain" })}
                    className={`px-2 py-1 text-[10px] transition-colors ${
                      layoutImage?.fit === "contain" ? "bg-cy-accent/20 text-cy-accent" : "text-cy-muted hover:bg-cy-input/50"
                    }`}
                  >
                    適應
                  </button>
                </div>
              </div>

              {/* Overlay Type — only for overlay mode */}
              {layoutMode === "image-overlay" && (
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-cy-muted w-14 shrink-0">遮罩</span>
                  <div className="flex rounded-md overflow-hidden border border-cy-border/30">
                    {(
                      [
                        { value: "dark", label: "深色" },
                        { value: "light", label: "淺色" },
                        { value: "gradient", label: "漸層" },
                      ] as { value: "dark" | "light" | "gradient"; label: string }[]
                    ).map((ov) => (
                      <button
                        key={ov.value}
                        onClick={() => setSlideImage(selectedSlideId, { ...layoutImage, overlay: ov.value })}
                        className={`px-2 py-1 text-[10px] transition-colors ${
                          (layoutImage?.overlay ?? "dark") === ov.value
                            ? "bg-cy-accent/20 text-cy-accent"
                            : "text-cy-muted hover:bg-cy-input/50"
                        }`}
                      >
                        {ov.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
```

- [ ] **Step 5: Verify TypeScript compiles**

Run: `cd dashboard && npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add dashboard/src/components/skills/workstations/presentations/style-settings-panel.tsx
git commit -m "feat(slide-engine): add layout mode selector + image settings UI with upload/URL/preview"
```

---

## Batch 5: Final Verification

### Task 10: Build verification + visual test

- [ ] **Step 1: Full TypeScript check**

Run: `cd dashboard && npx tsc --noEmit --pretty`
Expected: Clean compile with no errors

- [ ] **Step 2: Build the dashboard**

Run: `cd dashboard && npm run build 2>&1 | tail -20`
Expected: Build succeeds

- [ ] **Step 3: Start dev server and test visually**

Run: `cd dashboard && npm run dev`

Manual verification checklist:
1. Open a presentation session with existing slides
2. Verify fragments are visible in browse mode (NOT hidden)
3. Verify content is vertically centered (no big bottom whitespace)
4. Select a slide → check Style Settings Panel shows new controls
5. Change badge position → verify badge moves in preview
6. Change text alignment → verify text aligns in preview
7. Set layout mode to "左右分割" → verify split grid appears
8. Upload an image → verify it shows in the image panel
9. Adjust split ratio slider → verify ratio changes
10. Switch to "圖片覆蓋" mode → verify overlay layout
11. Enter present mode → verify fragments hide and reveal one by one
12. Export HTML → verify self-contained file with embedded images

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat(slide-engine): V3.2 complete — layout control + image split + bug fixes"
```
