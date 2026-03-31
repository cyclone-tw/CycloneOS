# Slide Engine V2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace reveal.js-based slide renderer with a custom lightweight slide engine featuring 8 slide types, fragment animation, CSS-variable theming, and zero external dependencies.

**Architecture:** New `SlideContent` data model replaces coordinate-based `SlideBlock`. Template functions per slideType generate self-contained HTML with embedded CSS/JS. Themes migrate from reveal.js fields to CSS custom properties. The HTML engine assembles templates + CSS + nav JS into a single self-contained HTML file (~20-30KB).

**Tech Stack:** TypeScript, React (Next.js dashboard), Zustand store, pure HTML/CSS/JS output (no reveal.js, no Chart.js)

**Spec:** `docs/superpowers/specs/2026-03-27-slide-engine-v2-design.md`

**Note:** This project has no test infrastructure (no jest/vitest). Verification is done via `npm run build` (type checking) and Playwright browser screenshots.

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `dashboard/src/stores/presentations-store.ts` | **Modify** | New `SlideContent` type system, remove `SlideBlock`, add `setSlideLayout`/`updateSlideContent` actions |
| `dashboard/src/lib/presentation-themes.ts` | **Modify** | New `PresentationTheme` interface with `colors`/`fonts`/`isDark`, migrate 24 themes |
| `dashboard/src/lib/slide-templates.ts` | **Create** | 8 template functions (one per slideType), each returns HTML string |
| `dashboard/src/lib/slide-engine-css.ts` | **Create** | `buildCSS(theme)` — all template styles + fragment animation + responsive sizing |
| `dashboard/src/lib/slide-engine-nav.ts` | **Create** | `buildNavJS()` — keyboard/click navigation + fragment logic (~70 lines) |
| `dashboard/src/lib/presentations-utils.ts` | **Rewrite** | New `outlineToHtml()` orchestrator: CSS + fonts + slides + nav → single HTML |
| `dashboard/src/app/api/presentations/generate/route.ts` | **Modify** | New Claude prompt (slideType + content JSON, no coordinates) |
| `dashboard/src/components/skills/workstations/presentations/slide-preview.tsx` | **Modify** | Remove reveal.js postMessage, use hash-based nav |
| `dashboard/src/components/skills/workstations/presentations/slide-layout-editor.tsx` | **Create** | Layout Picker + content editor (replaces `slide-block-editor.tsx`) |
| `dashboard/src/components/skills/workstations/presentations/slide-block-editor.tsx` | **Delete** | Replaced by `slide-layout-editor.tsx` |
| `dashboard/src/components/skills/workstations/presentations/slide-thumbnail-list.tsx` | **Modify** | Adapt title extraction from `SlideBlock` → `SlideContent` |
| `dashboard/src/components/skills/workstations/presentations/outline-editor.tsx` | **Modify** | Import `SlideLayoutEditor` instead of `SlideBlockEditor` |
| `dashboard/src/components/skills/workstations/presentations/renderer-picker.tsx` | **Modify** | Rename `"revealjs"` → `"html"` |
| `dashboard/src/components/skills/workstations/presentations/theme-picker.tsx` | **Modify** | Update color swatch from `revealColors.accent` → `colors.accent` |

---

## Task 1: Store Data Model

**Files:**
- Modify: `dashboard/src/stores/presentations-store.ts`

This is the foundation — every other file depends on these types.

- [ ] **Step 1: Replace type definitions**

Replace the old types (`SlideLayout`, `SlideBlock`, `SlideDefinition`) with the new `SlideContent`-based system. Keep `RendererType` change for a later task to avoid breaking everything at once.

```typescript
// REMOVE these:
// export type SlideLayout = "title" | "content" | "two-column" | "image-full" | "blank";
// export type SlideBlock = { ... };

// ADD these NEW types:
export type SlideType =
  | "cover" | "section-divider" | "content" | "two-column"
  | "dataviz" | "quote" | "story-cards" | "closing";

export interface ContentItem {
  label: string;
  value?: string;
  color?: string;
  desc?: string;
}

export interface ContentBlock {
  title?: string;
  items?: ContentItem[];
  body?: string;
}

export interface BackgroundImage {
  url?: string;
  prompt?: string;
  overlay?: "dark" | "light" | "gradient";
  position?: "cover" | "contain" | "left" | "right";
}

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
}

// MODIFY SlideDefinition:
export interface SlideDefinition {
  id: string;
  order: number;
  content: SlideContent;  // Replaces: layout + blocks[]
}

// MODIFY RendererType (rename revealjs → html):
export type RendererType = "html" | "canva" | "felo";

// MODIFY RendererState (replace revealjs variant):
export type RendererState =
  | { type: "html"; html?: string }
  | { type: "canva"; designId?: string; transactionId?: string; elementMap?: Record<string, string>; pageDimensions?: { width: number; height: number } }
  | { type: "felo"; taskId?: string; pptUrl?: string; theme?: string };
```

- [ ] **Step 2: Update store actions**

Remove `updateBlock`, `setBlockImage`. Modify `addSlide`. Add `setSlideLayout`, `updateSlideContent`.

```typescript
// In the interface, REMOVE:
// updateBlock: (slideId: string, blockId: string, updates: Partial<SlideBlock>) => void;
// setBlockImage: (slideId: string, blockId: string, src: string) => void;

// KEEP updateSlide — signature changes automatically since SlideDefinition now has
// `content: SlideContent` instead of `layout + blocks[]`. Still used for order changes.
// No code change needed — the existing implementation works with the new shape.

// MODIFY addSlide signature:
addSlide: (slideType: SlideType, afterSlideId?: string) => void;

// ADD new actions:
setSlideLayout: (slideId: string, slideType: SlideType, variant: string) => void;
updateSlideContent: (slideId: string, updates: Partial<SlideContent>) => void;
```

Implementation of new/modified actions:

```typescript
addSlide: (slideType, afterSlideId) =>
  set((state) => ({
    sessions: updateSession(state.sessions, state.activeSessionId, (s) => {
      const newSlide: SlideDefinition = {
        id: generateId(),
        order: s.outline.slides.length,
        content: { slideType, variant: getDefaultVariant(slideType) },
      };
      const slides = [...s.outline.slides];
      if (afterSlideId) {
        const idx = slides.findIndex((sl) => sl.id === afterSlideId);
        slides.splice(idx + 1, 0, newSlide);
      } else {
        slides.push(newSlide);
      }
      slides.forEach((sl, i) => (sl.order = i));
      return { ...s, outline: { ...s.outline, slides }, selectedSlideId: newSlide.id };
    }),
  })),

setSlideLayout: (slideId, slideType, variant) =>
  set((state) => ({
    sessions: updateSession(state.sessions, state.activeSessionId, (s) => ({
      ...s,
      outline: {
        ...s.outline,
        slides: s.outline.slides.map((sl) =>
          sl.id === slideId
            ? { ...sl, content: { ...sl.content, slideType, variant } }
            : sl
        ),
      },
    })),
  })),

updateSlideContent: (slideId, updates) =>
  set((state) => ({
    sessions: updateSession(state.sessions, state.activeSessionId, (s) => ({
      ...s,
      outline: {
        ...s.outline,
        slides: s.outline.slides.map((sl) =>
          sl.id === slideId
            ? { ...sl, content: { ...sl.content, ...updates } }
            : sl
        ),
      },
    })),
  })),
```

Add helper function before `usePresentationsStore`:

```typescript
function getDefaultVariant(slideType: SlideType): string {
  const defaults: Record<SlideType, string> = {
    cover: "gradient",
    "section-divider": "dark",
    content: "bullets",
    "two-column": "text-text",
    dataviz: "horizontal-bars",
    quote: "simple",
    "story-cards": "grid-3",
    closing: "thank-you",
  };
  return defaults[slideType];
}
```

- [ ] **Step 3: Update createSession default renderer**

Change default from `"revealjs"` to `"html"`:

```typescript
// In createSession:
renderer: "html",
rendererState: { type: "html" },
```

- [ ] **Step 4: Remove old action implementations**

Delete the `updateBlock` and `setBlockImage` implementations entirely.

- [ ] **Step 5: Build check**

Run: `cd dashboard && npx tsc --noEmit 2>&1 | head -50`

Expected: Type errors in files that still import old types (this is expected — we fix them in later tasks). The store file itself should be clean.

- [ ] **Step 6: Commit**

```
git add dashboard/src/stores/presentations-store.ts
git commit -m "feat(presentations): replace SlideBlock with SlideContent data model

New SlideType system with 8 types + variants. Remove coordinate-based
SlideBlock. Add setSlideLayout and updateSlideContent actions.
Rename RendererType revealjs → html."
```

---

## Task 2: Theme System Migration

**Files:**
- Modify: `dashboard/src/lib/presentation-themes.ts`

- [ ] **Step 1: Replace PresentationTheme interface**

```typescript
export interface PresentationTheme {
  id: string;
  name: string;
  nameZh: string;
  category: ThemeCategory;

  colors: {
    bg: string;
    text: string;
    accent: string;
    secondary?: string;
    muted: string;
    cardBg?: string;
    barColors?: string[];
  };
  fonts: {
    heading: string;
    body: string;
    mono?: string;
  };

  isDark: boolean;
  googleFontsUrl?: string;

  // Kept for Canva/Felo renderers
  canvaStylePrompt: string;
  feloThemeId?: string;
}
```

- [ ] **Step 2: Migrate all 24 themes**

Apply these derivation rules to each theme:
- `isDark`: `true` if old `revealTheme` was `"night"` or `"black"`, else `false`
- `colors.muted`: if `isDark` → `"#94A3B8"`, if light → `"#64748B"`
- `colors.cardBg`: if `isDark` → `"rgba(30,41,59,0.85)"`, if light → `"rgba(255,255,255,0.9)"`
- `colors.barColors`: default `["#3B82F6","#10B981","#A78BFA","#F59E0B","#EF4444","#EC4899","#06B6D4"]`; if theme has `secondary`, use it as 2nd bar color
- `colors.bg`, `colors.text`, `colors.accent`, `colors.secondary` → copy from old `revealColors`
- `fonts.heading`, `fonts.body`, `fonts.mono` → copy from old `revealFonts`
- `googleFontsUrl`: construct from font names (extract family name before comma, URL-encode spaces)
- Remove `revealTheme`, `revealColors`, `revealFonts`

Example migration for `dark-tech`:

```typescript
{
  id: "dark-tech",
  name: "Dark Tech",
  nameZh: "暗黑科技",
  category: "startup",
  isDark: true,
  colors: {
    bg: "#0D0D0D",
    text: "#E8EDF4",
    accent: "#00D4FF",
    secondary: "#8B5CF6",
    muted: "#94A3B8",
    cardBg: "rgba(30,41,59,0.85)",
    barColors: ["#3B82F6", "#8B5CF6", "#A78BFA", "#F59E0B", "#EF4444", "#EC4899", "#06B6D4"],
  },
  fonts: {
    heading: "Space Grotesk, sans-serif",
    body: "Inter, sans-serif",
    mono: "JetBrains Mono, monospace",
  },
  googleFontsUrl: "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap",
  canvaStylePrompt: "Dark futuristic tech presentation with neon cyan and purple accents on black background, high contrast, developer-oriented",
},
```

Migrate ALL 24 themes following this pattern. For themes with `bg` that starts with `linear-gradient` (glass, aurora), keep the gradient string as-is in `colors.bg`.

- [ ] **Step 3: Build check**

Run: `cd dashboard && npx tsc --noEmit 2>&1 | head -50`

Expected: Errors in `theme-picker.tsx` (references `revealColors`) — fixed in Task 9.

- [ ] **Step 4: Commit**

```
git add dashboard/src/lib/presentation-themes.ts
git commit -m "feat(presentations): migrate 24 themes to new CSS-variable interface

Remove revealTheme/revealColors/revealFonts. Add colors/fonts/isDark/
googleFontsUrl/barColors/cardBg/muted fields."
```

---

## Task 3: Slide Templates

**Files:**
- Create: `dashboard/src/lib/slide-templates.ts`

This is the core rendering logic. Each function takes `SlideContent` + `index` + `total` and returns an HTML string for one slide.

- [ ] **Step 1: Create file with shared helpers and type imports**

```typescript
// dashboard/src/lib/slide-templates.ts

import type { SlideContent, SlideType } from "@/stores/presentations-store";

function esc(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function frag(content: string, tag = "div"): string {
  return `<${tag} class="fragment">${content}</${tag}>`;
}

/** Returns extra attributes for background image support on the outer .slide div */
function bgStyle(slide: SlideContent): string {
  if (!slide.backgroundImage?.url) return "";
  return ` data-bg style="background-image:url('${esc(slide.backgroundImage.url)}')"`;
}

function overlayClass(slide: SlideContent): string {
  if (!slide.backgroundImage?.url) return "";
  return ` overlay-${slide.backgroundImage.overlay ?? "dark"}`;
}

/** Dispatcher — calls the right template based on slideType */
export function slideToHtml(slide: SlideContent, index: number, total: number): string {
  const fn = TEMPLATES[slide.slideType] ?? TEMPLATES.content;
  return fn(slide, index, total);
}

type TemplateFn = (slide: SlideContent, index: number, total: number) => string;

const TEMPLATES: Record<SlideType, TemplateFn> = {
  cover: renderCover,
  "section-divider": renderSectionDivider,
  content: renderContent,
  "two-column": renderTwoColumn,
  dataviz: renderDataviz,
  quote: renderQuote,
  "story-cards": renderStoryCards,
  closing: renderClosing,
};
```

- [ ] **Step 2: Implement cover template**

```typescript
function renderCover(slide: SlideContent, index: number, total: number): string {
  const variant = slide.variant || "gradient";
  return `<div class="slide cover ${variant}${overlayClass(slide)}" data-index="${index}"${bgStyle(slide)}>
  <div class="slide-inner cover-inner">
    ${slide.badge ? frag(`<div class="badge">${esc(slide.badge)}</div>`) : ""}
    ${slide.title ? frag(`<h1>${esc(slide.title)}</h1>`) : ""}
    ${slide.subtitle ? frag(`<p class="subtitle">${esc(slide.subtitle)}</p>`) : ""}
    ${slide.footnote ? frag(`<p class="footnote">${esc(slide.footnote)}</p>`) : ""}
  </div>
</div>`;
}
```

**Note:** All remaining templates (Steps 3-9) must also use `overlayClass(slide)` in the outer div's class and `bgStyle(slide)` for the background-image attribute, following the same pattern as `renderCover` above.

- [ ] **Step 3: Implement section-divider template**

```typescript
function renderSectionDivider(slide: SlideContent, index: number, total: number): string {
  const variant = slide.variant || "dark";
  return `<div class="slide section-divider ${variant}" data-index="${index}">
  <div class="slide-inner section-divider-inner">
    ${slide.subtitle ? frag(`<p class="section-label">${esc(slide.subtitle)}</p>`) : ""}
    ${slide.title ? frag(`<h2 class="section-title">${esc(slide.title)}</h2>`) : ""}
  </div>
</div>`;
}
```

- [ ] **Step 4: Implement content template**

```typescript
function renderContent(slide: SlideContent, index: number, total: number): string {
  const variant = slide.variant || "bullets";
  let bodyHtml = "";

  if (variant === "bullets" && slide.items) {
    bodyHtml = slide.items.map((item) =>
      `<li class="fragment"><strong>${esc(item.label)}</strong>${item.desc ? `<span class="item-desc"> — ${esc(item.desc)}</span>` : ""}</li>`
    ).join("\n      ");
    bodyHtml = `<ul class="content-list">\n      ${bodyHtml}\n    </ul>`;
  } else if (variant === "numbered" && slide.items) {
    bodyHtml = slide.items.map((item, i) =>
      `<li class="fragment"><span class="num">${i + 1}</span><strong>${esc(item.label)}</strong>${item.desc ? `<span class="item-desc"> — ${esc(item.desc)}</span>` : ""}</li>`
    ).join("\n      ");
    bodyHtml = `<ol class="content-list numbered">\n      ${bodyHtml}\n    </ol>`;
  } else if (slide.body) {
    bodyHtml = frag(`<p class="body-text">${esc(slide.body)}</p>`);
  }

  return `<div class="slide content ${variant}" data-index="${index}">
  <div class="slide-inner content-inner">
    ${slide.title ? frag(`<h2>${esc(slide.title)}</h2>`) : ""}
    ${bodyHtml}
    ${slide.footnote ? frag(`<p class="footnote">${esc(slide.footnote)}</p>`) : ""}
  </div>
</div>`;
}
```

- [ ] **Step 5: Implement two-column template**

```typescript
function renderTwoColumn(slide: SlideContent, index: number, total: number): string {
  const variant = slide.variant || "text-text";

  function renderColumn(col: { title?: string; items?: { label: string; value?: string; desc?: string }[]; body?: string }, className: string): string {
    let inner = "";
    if (col.title) inner += `<h3 class="col-title">${esc(col.title)}</h3>`;
    if (col.items) {
      inner += `<ul class="col-list">${col.items.map((item) =>
        `<li><strong>${esc(item.label)}</strong>${item.value ? `: ${esc(item.value)}` : ""}${item.desc ? `<span class="item-desc"> — ${esc(item.desc)}</span>` : ""}</li>`
      ).join("")}</ul>`;
    }
    if (col.body) inner += `<p class="col-body">${esc(col.body)}</p>`;
    return frag(`<div class="${className}">${inner}</div>`);
  }

  const cols = slide.columns ?? [{ body: "" }, { body: "" }];

  return `<div class="slide two-column ${variant}" data-index="${index}">
  <div class="slide-inner two-column-inner">
    ${slide.title ? frag(`<h2>${esc(slide.title)}</h2>`) : ""}
    <div class="columns">
      ${renderColumn(cols[0], "col col-left")}
      ${renderColumn(cols[1], "col col-right")}
    </div>
    ${slide.footnote ? frag(`<p class="footnote">${esc(slide.footnote)}</p>`) : ""}
  </div>
</div>`;
}
```

- [ ] **Step 6: Implement dataviz template**

```typescript
function renderDataviz(slide: SlideContent, index: number, total: number): string {
  const variant = slide.variant || "horizontal-bars";

  let vizHtml = "";

  if (variant === "horizontal-bars" && slide.items) {
    const maxVal = Math.max(...slide.items.map((item) => parseFloat(item.value ?? "0") || 0), 1);
    vizHtml = slide.items.map((item, i) => {
      const numVal = parseFloat(item.value ?? "0") || 0;
      const pct = Math.round((numVal / maxVal) * 100);
      const color = item.color ?? `var(--bar-${i % 7})`;
      return frag(`<div class="bar-row">
        <span class="bar-label">${esc(item.label)}</span>
        <div class="bar-track"><div class="bar-fill" style="width:${pct}%;background:${color}"></div></div>
        <span class="bar-value">${esc(item.value ?? "")}</span>
      </div>`);
    }).join("\n    ");
  } else if (variant === "big-number" && slide.bigNumber) {
    vizHtml = frag(`<div class="big-number">
      <span class="big-value">${esc(slide.bigNumber.value)}</span>
      <span class="big-label">${esc(slide.bigNumber.label)}</span>
    </div>`);
    if (slide.body) {
      vizHtml += frag(`<p class="body-text">${esc(slide.body)}</p>`);
    }
  } else if (variant === "stats-row" && slide.stats) {
    vizHtml = `<div class="stats-row">${slide.stats.map((stat) =>
      frag(`<div class="stat-card">
        <span class="stat-value">${esc(stat.value)}</span>
        <span class="stat-label">${esc(stat.label)}</span>
      </div>`)
    ).join("")}</div>`;
  } else if (variant === "comparison" && slide.columns) {
    const cols = slide.columns;
    vizHtml = `<div class="comparison-grid">
      ${frag(`<div class="compare-col compare-left">
        <h3>${esc(cols[0].title ?? "")}</h3>
        <ul>${(cols[0].items ?? []).map((item) => `<li>${esc(item.label)}${item.value ? `: ${esc(item.value)}` : ""}</li>`).join("")}</ul>
      </div>`)}
      ${frag(`<div class="compare-col compare-right">
        <h3>${esc(cols[1].title ?? "")}</h3>
        <ul>${(cols[1].items ?? []).map((item) => `<li>${esc(item.label)}${item.value ? `: ${esc(item.value)}` : ""}</li>`).join("")}</ul>
      </div>`)}
    </div>`;
  }

  return `<div class="slide dataviz ${variant}" data-index="${index}">
  <div class="slide-inner dataviz-inner">
    ${slide.title ? frag(`<h2>${esc(slide.title)}</h2>`) : ""}
    ${vizHtml}
    ${slide.footnote ? frag(`<p class="footnote">${esc(slide.footnote)}</p>`) : ""}
  </div>
</div>`;
}
```

- [ ] **Step 7: Implement quote template**

```typescript
function renderQuote(slide: SlideContent, index: number, total: number): string {
  const variant = slide.variant || "simple";
  const q = slide.quote ?? { text: "" };

  return `<div class="slide quote ${variant}" data-index="${index}">
  <div class="slide-inner quote-inner">
    ${frag(`<blockquote>
      <p class="quote-text">${esc(q.text)}</p>
      ${q.author ? `<cite class="quote-author">— ${esc(q.author)}${q.source ? `, ${esc(q.source)}` : ""}</cite>` : ""}
    </blockquote>`)}
    ${slide.body ? frag(`<p class="body-text">${esc(slide.body)}</p>`) : ""}
  </div>
</div>`;
}
```

- [ ] **Step 8: Implement story-cards template**

```typescript
function renderStoryCards(slide: SlideContent, index: number, total: number): string {
  const variant = slide.variant || "grid-3";
  const cards = slide.cards ?? [];

  const cardsHtml = cards.map((card) =>
    frag(`<div class="story-card">
      ${card.icon ? `<span class="card-icon">${esc(card.icon)}</span>` : ""}
      <h3 class="card-title">${esc(card.title)}</h3>
      <p class="card-body">${esc(card.body)}</p>
    </div>`)
  ).join("\n    ");

  return `<div class="slide story-cards ${variant}" data-index="${index}">
  <div class="slide-inner story-cards-inner">
    ${slide.title ? frag(`<h2>${esc(slide.title)}</h2>`) : ""}
    <div class="cards-grid ${variant}">${cardsHtml}</div>
    ${slide.footnote ? frag(`<p class="footnote">${esc(slide.footnote)}</p>`) : ""}
  </div>
</div>`;
}
```

- [ ] **Step 9: Implement closing template**

```typescript
function renderClosing(slide: SlideContent, index: number, total: number): string {
  const variant = slide.variant || "thank-you";

  return `<div class="slide closing ${variant}" data-index="${index}">
  <div class="slide-inner closing-inner">
    ${slide.title ? frag(`<h1>${esc(slide.title)}</h1>`) : ""}
    ${slide.body ? frag(`<p class="cta-text">${esc(slide.body)}</p>`) : ""}
    ${slide.footnote ? frag(`<p class="footnote">${esc(slide.footnote)}</p>`) : ""}
  </div>
</div>`;
}
```

- [ ] **Step 10: Commit**

```
git add dashboard/src/lib/slide-templates.ts
git commit -m "feat(presentations): add 8 slide template functions

cover, section-divider, content, two-column, dataviz, quote,
story-cards, closing — each returns self-contained HTML with
fragment animation classes."
```

---

## Task 4: CSS Generator

**Files:**
- Create: `dashboard/src/lib/slide-engine-css.ts`

- [ ] **Step 1: Create buildCSS function**

This generates all CSS for the slide deck: CSS variables from theme, base layout, each slideType's styles, fragment animation, navigation UI, and background image support.

```typescript
// dashboard/src/lib/slide-engine-css.ts

import type { PresentationTheme } from "./presentation-themes";

export function buildCSS(theme: PresentationTheme): string {
  const c = theme.colors;
  const f = theme.fonts;
  const secondary = c.secondary ?? c.accent;
  const cardBg = c.cardBg ?? (theme.isDark ? "rgba(30,41,59,0.85)" : "rgba(255,255,255,0.9)");
  const barColors = c.barColors ?? ["#3B82F6","#10B981","#A78BFA","#F59E0B","#EF4444","#EC4899","#06B6D4"];

  return `
/* === CSS Variables === */
:root {
  --slide-bg: ${c.bg};
  --slide-text: ${c.text};
  --slide-accent: ${c.accent};
  --slide-secondary: ${secondary};
  --slide-muted: ${c.muted};
  --slide-card-bg: ${cardBg};
  --font-heading: ${f.heading};
  --font-body: ${f.body};
  --font-mono: ${f.mono ?? "monospace"};
  ${barColors.map((color, i) => `--bar-${i}: ${color};`).join("\n  ")}
}

/* === Reset & Base === */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html, body { width: 100%; height: 100%; overflow: hidden; }
body {
  font-family: var(--font-body);
  color: var(--slide-text);
  ${c.bg.startsWith("linear") ? `background: ${c.bg};` : `background-color: ${c.bg};`}
  -webkit-font-smoothing: antialiased;
}

/* === Slide Container === */
.slide-deck { width: 100%; height: 100%; position: relative; }
.slide {
  width: 100%; height: 100vh;
  display: none; /* shown via .active */
  ${c.bg.startsWith("linear") ? `background: ${c.bg};` : `background-color: ${c.bg};`}
  position: relative; overflow: hidden;
}
.slide.active { display: flex; }
.slide-inner {
  width: 100%; height: 100%;
  display: flex; flex-direction: column;
  padding: 60px 80px;
  justify-content: center;
}

/* === Typography === */
h1 { font-family: var(--font-heading); font-size: 72px; font-weight: 700; line-height: 1.1; color: var(--slide-accent); }
h2 { font-family: var(--font-heading); font-size: 44px; font-weight: 700; line-height: 1.2; color: var(--slide-accent); margin-bottom: 32px; }
h3 { font-family: var(--font-heading); font-size: 28px; font-weight: 600; line-height: 1.3; color: var(--slide-accent); }
p, li { font-size: 20px; line-height: 1.6; }
.subtitle { font-size: 28px; color: var(--slide-muted); margin-top: 16px; }
.footnote { font-size: 16px; color: var(--slide-muted); margin-top: auto; padding-top: 24px; }
.badge { font-size: 14px; letter-spacing: 3px; text-transform: uppercase; color: var(--slide-muted); margin-bottom: 24px; }
.body-text { font-size: 20px; line-height: 1.7; max-width: 800px; }
.item-desc { color: var(--slide-muted); font-weight: 400; }

/* === Cover === */
.cover .slide-inner { justify-content: center; align-items: center; text-align: center; padding: 80px; }
.cover h1 { font-size: 72px; }
.cover.gradient { ${c.bg.startsWith("linear") ? "" : `background: linear-gradient(135deg, ${c.accent}15, ${secondary}15);`} }

/* === Section Divider === */
.section-divider .slide-inner { justify-content: center; align-items: flex-start; padding: 80px 100px; }
.section-divider.dark { background-color: ${theme.isDark ? c.accent : c.text}; }
.section-divider.dark h2, .section-divider.dark .section-label { color: ${theme.isDark ? c.bg : "#FFFFFF"}; }
.section-divider .section-label { font-size: 16px; letter-spacing: 3px; text-transform: uppercase; color: var(--slide-muted); margin-bottom: 16px; }
.section-divider .section-title { font-size: 56px; max-width: 80%; }
.section-divider.accent { background-color: var(--slide-accent); }
.section-divider.accent h2, .section-divider.accent .section-label { color: ${theme.isDark ? c.bg : "#FFFFFF"}; }

/* === Content === */
.content .slide-inner { justify-content: flex-start; padding-top: 80px; }
.content-list { list-style: none; padding: 0; }
.content-list li { padding: 12px 0; border-bottom: 1px solid ${theme.isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)"}; font-size: 20px; }
.content-list.numbered li { display: flex; align-items: baseline; gap: 16px; }
.content-list .num { font-size: 32px; font-weight: 700; color: var(--slide-accent); min-width: 36px; font-family: var(--font-heading); }

/* === Two Column === */
.two-column-inner { justify-content: flex-start; padding-top: 80px; }
.columns { display: grid; grid-template-columns: 1fr 1fr; gap: 48px; flex: 1; align-items: start; }
.col-title { font-size: 24px; margin-bottom: 16px; }
.col-list { list-style: none; padding: 0; }
.col-list li { padding: 8px 0; font-size: 20px; border-bottom: 1px solid ${theme.isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)"}; }
.col-body { font-size: 20px; line-height: 1.7; }

/* === Dataviz === */
.dataviz-inner { justify-content: flex-start; padding-top: 80px; }
.bar-row { display: flex; align-items: center; gap: 16px; margin-bottom: 12px; }
.bar-label { font-size: 20px; min-width: 160px; text-align: right; }
.bar-track { flex: 1; height: 52px; background: ${theme.isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)"}; border-radius: 8px; overflow: hidden; }
.bar-fill { height: 100%; border-radius: 8px; transition: width 0.8s ease; }
.bar-value { font-size: 18px; font-weight: 700; min-width: 80px; font-family: var(--font-mono); color: var(--slide-accent); }

.big-number { text-align: center; padding: 40px 0; }
.big-value { font-size: 120px; font-weight: 800; font-family: var(--font-heading); color: var(--slide-accent); display: block; line-height: 1; }
.big-label { font-size: 24px; color: var(--slide-muted); display: block; margin-top: 16px; }

.stats-row { display: flex; gap: 24px; justify-content: center; flex-wrap: wrap; }
.stat-card { background: var(--slide-card-bg); border-radius: 16px; padding: 36px; text-align: center; flex: 1; min-width: 160px; }
.stat-value { font-size: 80px; font-weight: 800; font-family: var(--font-heading); color: var(--slide-accent); display: block; line-height: 1; }
.stat-label { font-size: 18px; color: var(--slide-muted); display: block; margin-top: 12px; }

.comparison-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; }
.compare-col { background: var(--slide-card-bg); border-radius: 16px; padding: 36px; }
.compare-col h3 { margin-bottom: 16px; }
.compare-col ul { list-style: none; padding: 0; }
.compare-col li { padding: 8px 0; font-size: 20px; border-bottom: 1px solid ${theme.isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)"}; }
.compare-left { border-left: 4px solid var(--slide-accent); }
.compare-right { border-left: 4px solid var(--slide-secondary); }

/* === Quote === */
.quote-inner { justify-content: center; align-items: center; text-align: center; padding: 80px 120px; }
blockquote { max-width: 900px; }
.quote-text { font-size: 32px; font-style: italic; line-height: 1.5; font-family: var(--font-heading); }
.quote-author { display: block; margin-top: 24px; font-size: 18px; color: var(--slide-muted); font-style: normal; }
.quote.fullscreen .slide-inner { padding: 80px 80px; }
.quote.fullscreen .quote-text { font-size: 40px; }
.quote.card-overlay blockquote { background: var(--slide-card-bg); border-radius: 20px; padding: 48px; border-left: 4px solid var(--slide-accent); text-align: left; }
.quote.card-overlay .quote-text { font-size: 28px; }

/* === Story Cards === */
.story-cards-inner { justify-content: flex-start; padding-top: 80px; }
.cards-grid { display: grid; gap: 24px; flex: 1; align-items: start; }
.cards-grid.grid-3 { grid-template-columns: repeat(3, 1fr); }
.cards-grid.grid-2 { grid-template-columns: repeat(2, 1fr); }
.cards-grid.single { grid-template-columns: 1fr; max-width: 600px; }
.story-card { background: var(--slide-card-bg); border-radius: 16px; padding: 36px; }
.card-icon { font-size: 32px; display: block; margin-bottom: 12px; }
.card-title { font-size: 22px; margin-bottom: 8px; }
.card-body { font-size: 20px; color: var(--slide-muted); line-height: 1.5; }

/* === Closing === */
.closing .slide-inner { justify-content: center; align-items: center; text-align: center; padding: 80px; }
.closing h1 { font-size: 72px; margin-bottom: 24px; }
.cta-text { font-size: 24px; color: var(--slide-muted); max-width: 600px; }

/* === Fragment Animation === */
.fragment { opacity: 0; transform: translateY(20px); transition: opacity 0.5s ease, transform 0.5s ease; }
.fragment.visible { opacity: 1; transform: translateY(0); }

/* === Background Image Support === */
.slide[data-bg] { background-size: cover; background-position: center; }
.slide[data-bg]::before { content: ""; position: absolute; inset: 0; z-index: 0; }
.slide.overlay-dark[data-bg]::before { background: rgba(0,0,0,0.55); }
.slide.overlay-light[data-bg]::before { background: rgba(255,255,255,0.4); }
.slide.overlay-gradient[data-bg]::before { background: linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 60%); }
.slide[data-bg] > * { position: relative; z-index: 1; }

/* === Navigation UI === */
.nav-bar { position: fixed; bottom: 0; left: 0; right: 0; height: 48px; display: flex; align-items: center; padding: 0 24px; z-index: 100; }
.nav-title { font-size: 13px; color: var(--slide-muted); opacity: 0.6; position: fixed; top: 16px; left: 24px; font-family: var(--font-body); }
.progress-bar { position: fixed; bottom: 0; left: 0; height: 4px; background: var(--slide-accent); transition: width 0.3s ease; z-index: 101; }
.page-counter { font-size: 14px; color: var(--slide-muted); font-family: var(--font-mono); }
.nav-arrows { margin-left: auto; display: flex; gap: 8px; }
.nav-arrows button { background: none; border: 1px solid ${theme.isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.1)"}; color: var(--slide-muted); width: 36px; height: 36px; border-radius: 8px; cursor: pointer; font-size: 18px; display: flex; align-items: center; justify-content: center; }
.nav-arrows button:hover { background: ${theme.isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.04)"}; color: var(--slide-text); }
`;
}
```

- [ ] **Step 2: Commit**

```
git add dashboard/src/lib/slide-engine-css.ts
git commit -m "feat(presentations): add CSS generator with theme variables and all slide styles"
```

---

## Task 5: Navigation JS

**Files:**
- Create: `dashboard/src/lib/slide-engine-nav.ts`

- [ ] **Step 1: Create buildNavJS function**

```typescript
// dashboard/src/lib/slide-engine-nav.ts

export function buildNavJS(): string {
  return `
(function() {
  const slides = document.querySelectorAll('.slide');
  const total = slides.length;
  let current = 0;
  let fragmentIndex = 0;
  let lastKeyTime = 0;

  function getFragments(slideEl) {
    return slideEl.querySelectorAll('.fragment');
  }

  function showSlide(index) {
    slides.forEach((s, i) => {
      s.classList.toggle('active', i === index);
    });
    current = index;
    // Reset fragment state
    const frags = getFragments(slides[current]);
    fragmentIndex = 0;
    frags.forEach(f => f.classList.remove('visible'));
    updateUI();
  }

  function revealNextFragment() {
    const frags = getFragments(slides[current]);
    if (fragmentIndex < frags.length) {
      frags[fragmentIndex].classList.add('visible');
      fragmentIndex++;
      updateUI();
      return true;
    }
    return false;
  }

  function hideLastFragment() {
    const frags = getFragments(slides[current]);
    if (fragmentIndex > 0) {
      fragmentIndex--;
      frags[fragmentIndex].classList.remove('visible');
      updateUI();
      return true;
    }
    return false;
  }

  function next() {
    if (!revealNextFragment()) {
      if (current < total - 1) showSlide(current + 1);
    }
  }

  function prev() {
    if (!hideLastFragment()) {
      if (current > 0) {
        showSlide(current - 1);
        // Show all fragments on previous slide
        const frags = getFragments(slides[current]);
        frags.forEach(f => f.classList.add('visible'));
        fragmentIndex = frags.length;
        updateUI();
      }
    }
  }

  function updateUI() {
    const counter = document.getElementById('page-counter');
    const progress = document.getElementById('progress-bar');
    if (counter) counter.textContent = (current + 1) + ' / ' + total;
    if (progress) {
      const frags = getFragments(slides[current]);
      const slideProgress = frags.length > 0 ? fragmentIndex / frags.length : 1;
      const overallProgress = (current + slideProgress) / total * 100;
      progress.style.width = overallProgress + '%';
    }
  }

  // Keyboard navigation with debounce
  document.addEventListener('keydown', function(e) {
    const now = Date.now();
    if (now - lastKeyTime < 100) return;
    lastKeyTime = now;

    if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'Enter') {
      e.preventDefault(); next();
    } else if (e.key === 'ArrowLeft' || e.key === 'Backspace') {
      e.preventDefault(); prev();
    } else if (e.key === 'ArrowDown' || e.key === 'PageDown') {
      e.preventDefault();
      if (current < total - 1) showSlide(current + 1);
    } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
      e.preventDefault();
      if (current > 0) showSlide(current - 1);
    }
  });

  // Click navigation buttons
  document.getElementById('nav-prev')?.addEventListener('click', prev);
  document.getElementById('nav-next')?.addEventListener('click', next);

  // External navigation (from parent iframe)
  window.addEventListener('message', function(e) {
    if (e.data && typeof e.data.goToSlide === 'number') {
      showSlide(Math.max(0, Math.min(e.data.goToSlide, total - 1)));
      // Reveal all fragments on navigated slide
      const frags = getFragments(slides[current]);
      frags.forEach(f => f.classList.add('visible'));
      fragmentIndex = frags.length;
      updateUI();
    }
  });

  // Initialize
  if (total > 0) showSlide(0);
})();
`;
}
```

- [ ] **Step 2: Commit**

```
git add dashboard/src/lib/slide-engine-nav.ts
git commit -m "feat(presentations): add keyboard/click navigation JS with fragment animation"
```

---

## Task 6: HTML Engine Orchestrator

**Files:**
- Rewrite: `dashboard/src/lib/presentations-utils.ts`

- [ ] **Step 1: Rewrite outlineToHtml**

```typescript
// dashboard/src/lib/presentations-utils.ts

import type { SlideOutline } from "@/stores/presentations-store";
import { getThemeById, type PresentationTheme } from "./presentation-themes";
import { slideToHtml } from "./slide-templates";
import { buildCSS } from "./slide-engine-css";
import { buildNavJS } from "./slide-engine-nav";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Convert SlideOutline to a self-contained HTML document.
 * No external dependencies except Google Fonts.
 */
export function outlineToHtml(
  outline: SlideOutline,
  theme?: PresentationTheme
): string {
  const resolvedTheme = theme ?? (outline.theme ? getThemeById(outline.theme) : undefined) ?? getDefaultTheme();

  const slidesHtml = outline.slides
    .sort((a, b) => a.order - b.order)
    .map((slide, i) => slideToHtml(slide.content, i, outline.slides.length))
    .join("\n");

  const fontsLink = resolvedTheme.googleFontsUrl
    ? `<link rel="stylesheet" href="${resolvedTheme.googleFontsUrl}">`
    : "";

  return `<!DOCTYPE html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(outline.title)}</title>
  ${fontsLink}
  <style>${buildCSS(resolvedTheme)}</style>
</head>
<body>
  <div class="slide-deck">
${slidesHtml}
  </div>

  <!-- Navigation UI -->
  <div class="nav-title">${escapeHtml(outline.title)}</div>
  <div class="nav-bar">
    <span id="page-counter" class="page-counter">1 / ${outline.slides.length}</span>
    <div class="nav-arrows">
      <button id="nav-prev" aria-label="Previous">&#8592;</button>
      <button id="nav-next" aria-label="Next">&#8594;</button>
    </div>
  </div>
  <div id="progress-bar" class="progress-bar"></div>

  <script>${buildNavJS()}<\/script>
</body>
</html>`;
}

function getDefaultTheme(): PresentationTheme {
  return getThemeById("mckinsey")!;
}
```

Note: the old `outlineToRevealHtml` is completely replaced. The function is now named `outlineToHtml`.

- [ ] **Step 2: Commit**

```
git add dashboard/src/lib/presentations-utils.ts
git commit -m "feat(presentations): rewrite HTML engine — zero dependencies, CSS-variable theming

Replaces outlineToRevealHtml with outlineToHtml. Assembles
slide templates + CSS + nav JS into single self-contained HTML."
```

---

## Task 7: Generate Route (Claude Prompt)

**Files:**
- Modify: `dashboard/src/app/api/presentations/generate/route.ts`

- [ ] **Step 1: Replace SLIDE_OUTLINE_PROMPT**

```typescript
const SLIDE_OUTLINE_PROMPT = (
  filePaths: string[],
  instructions: string,
  themeName?: string,
  themePrompt?: string,
) => `<role>You are a JSON-only presentation outline generator. You MUST respond with ONLY a JSON object. No text before or after the JSON. No explanation. No markdown fences.</role>

${filePaths.length > 0 ? `<sources>Read these source files first:
${filePaths.map((p) => `- ${p}`).join("\n")}</sources>` : ""}

<task>${instructions || "Create a professional 5-slide presentation."}</task>

<slide-types>
Available slide types and variants:
| slideType | Variants | Purpose |
|-----------|----------|---------|
| cover | image-bg, gradient, clean | Title slide with background |
| section-divider | dark, accent | Chapter separator |
| content | bullets, numbered, paragraph | General content with title + body |
| two-column | text-text, text-image, text-list | Side-by-side comparison |
| dataviz | horizontal-bars, big-number, stats-row, comparison | Data visualization |
| quote | fullscreen, card-overlay, simple | Quotation / testimonial |
| story-cards | grid-3, grid-2, single | Case study cards |
| closing | cta, summary, thank-you | End slide |
</slide-types>

<content-fields>
Each slide has a "content" object with these fields (use only what's needed):
- title (string): slide title
- subtitle (string): secondary text
- body (string): paragraph text
- badge (string): cover top badge (e.g., "ANTHROPIC 2026")
- items (array): [{label, value?, color?, desc?}] for bullets/bars/numbered lists
- columns (array of 2): [{title?, items?, body?}] for two-column and comparison
- quote (object): {text, author?, source?} for quote slides
- cards (array): [{title, body, icon?}] for story-cards
- bigNumber (object): {value, label} for big-number dataviz
- stats (array): [{value, label}] for stats-row dataviz
- footnote (string): bottom text, source attribution
</content-fields>

${themeName ? `<theme>${themeName} — ${themePrompt ?? ""}\nIf the theme is dark/dramatic, lean into section-dividers and dataviz.\nIf the theme is minimal, prefer shorter text and more white space.</theme>` : ""}

<format>Respond with ONLY this JSON structure:
{"title":"string","slides":[{"id":"1","order":0,"content":{"slideType":"cover","variant":"gradient","title":"...","subtitle":"..."}}]}

Rules:
- Choose slideType and variant that best serve the narrative
- Use section-dividers to create rhythm between content sections
- Vary slide types — don't use the same type 3 times in a row
- For dataviz: include actual numbers/percentages when available
- Content language: match user's instruction language
- Generate at least 5 slides
- Use real content, not placeholder text</format>`;
```

- [ ] **Step 2: Update POST handler to pass theme info**

In the POST function, after extracting request body, get theme details:

```typescript
export async function POST(request: Request) {
  const { sources = [], aspectRatio = "16:9", instructions = "", theme } = await request.json();

  // Import getThemeById to resolve theme info for the prompt
  const { getThemeById } = await import("@/lib/presentation-themes");
  const themeObj = theme ? getThemeById(theme) : undefined;

  const filePaths = sources.map((s: { path: string }) => s.path);
  const prompt = SLIDE_OUTLINE_PROMPT(
    filePaths,
    instructions,
    themeObj?.name,
    themeObj?.canvaStylePrompt,
  );

  // ... rest of handler unchanged
```

- [ ] **Step 3: Update JSON validation in the close handler**

After parsing the outline JSON, add validation to normalize slideType/variant and regenerate IDs:

```typescript
// Inside child.on("close", ...) after outline is parsed:
if (outline && outline.title && outline.slides) {
  // Validate and normalize
  const validTypes = new Set(["cover","section-divider","content","two-column","dataviz","quote","story-cards","closing"]);
  const variantDefaults: Record<string, string> = {
    cover: "gradient", "section-divider": "dark", content: "bullets",
    "two-column": "text-text", dataviz: "horizontal-bars", quote: "simple",
    "story-cards": "grid-3", closing: "thank-you",
  };

  for (const slide of outline.slides) {
    // Regenerate IDs
    slide.id = crypto.randomUUID();

    // Normalize content
    if (!slide.content) {
      slide.content = { slideType: "content", variant: "bullets", title: `Slide ${slide.order + 1}` };
    }
    if (!validTypes.has(slide.content.slideType)) {
      slide.content.slideType = "content";
    }
    if (!slide.content.variant) {
      slide.content.variant = variantDefaults[slide.content.slideType] ?? "bullets";
    }
  }

  send("outline", { outline, sessionId });
}
```

- [ ] **Step 4: Commit**

```
git add dashboard/src/app/api/presentations/generate/route.ts
git commit -m "feat(presentations): update Claude prompt for slideType + content model

New prompt teaches Claude the 8 slide types and 22 variants.
Output validation normalizes types, regenerates UUIDs."
```

---

## Task 8: Slide Preview

**Files:**
- Modify: `dashboard/src/components/skills/workstations/presentations/slide-preview.tsx`

- [ ] **Step 1: Update imports and HTML generation**

```typescript
// Change import:
import { outlineToHtml } from "@/lib/presentations-utils";
// (was: outlineToRevealHtml)

// Update useMemo:
const html = useMemo(() => {
  if (!session || slides.length === 0) return "";
  return outlineToHtml(session.outline);
}, [session?.outline, slides.length]);
// Note: aspectRatio removed from deps — the new engine is always 100vh.
```

- [ ] **Step 2: Replace reveal.js postMessage with new nav protocol**

Replace the `useEffect` for navigation:

```typescript
useEffect(() => {
  if (!iframeRef.current || selectedIndex < 0) return;
  const iframe = iframeRef.current;
  const timer = setTimeout(() => {
    try {
      iframe.contentWindow?.postMessage({ goToSlide: selectedIndex }, "*");
    } catch {
      // iframe not ready
    }
  }, 200);
  return () => clearTimeout(timer);
}, [selectedIndex]);
```

- [ ] **Step 3: Remove htmlWithNav injection**

Remove the `htmlWithNav` variable and the `html.replace("</body>", ...)` block. Use `html` directly for `srcDoc`:

```typescript
// Remove: const htmlWithNav = html.replace(...)

// In the iframe:
<iframe
  ref={iframeRef}
  srcDoc={html}
  className="w-full h-full border-0"
  sandbox="allow-scripts"
  title="Slide Preview"
/>
```

- [ ] **Step 4: Update export handler**

The `handleExportHtml` already uses `html` directly, which is correct. No change needed.

- [ ] **Step 5: Commit**

```
git add dashboard/src/components/skills/workstations/presentations/slide-preview.tsx
git commit -m "feat(presentations): update preview to use new HTML engine

Remove reveal.js postMessage, use goToSlide message protocol."
```

---

## Task 9: Layout Editor (replaces Block Editor)

**Files:**
- Create: `dashboard/src/components/skills/workstations/presentations/slide-layout-editor.tsx`
- Delete: `dashboard/src/components/skills/workstations/presentations/slide-block-editor.tsx`
- Modify: `dashboard/src/components/skills/workstations/presentations/outline-editor.tsx`

- [ ] **Step 1: Create slide-layout-editor.tsx**

```typescript
"use client";
import { usePresentationsStore, type SlideDefinition, type SlideType, type SlideContent } from "@/stores/presentations-store";
import { Trash2 } from "lucide-react";

const SLIDE_TYPES: { value: SlideType; label: string; icon: string }[] = [
  { value: "cover", label: "封面", icon: "🎯" },
  { value: "section-divider", label: "分隔頁", icon: "📌" },
  { value: "content", label: "內容", icon: "📝" },
  { value: "two-column", label: "雙欄", icon: "⬜⬜" },
  { value: "dataviz", label: "數據", icon: "📊" },
  { value: "quote", label: "引言", icon: "💬" },
  { value: "story-cards", label: "卡片", icon: "🃏" },
  { value: "closing", label: "結尾", icon: "🎬" },
];

const VARIANTS: Record<SlideType, { value: string; label: string }[]> = {
  cover: [
    { value: "gradient", label: "漸層" },
    { value: "image-bg", label: "背景圖" },
    { value: "clean", label: "簡潔" },
  ],
  "section-divider": [
    { value: "dark", label: "深色" },
    { value: "accent", label: "強調色" },
  ],
  content: [
    { value: "bullets", label: "列點" },
    { value: "numbered", label: "編號" },
    { value: "paragraph", label: "段落" },
  ],
  "two-column": [
    { value: "text-text", label: "文字-文字" },
    { value: "text-image", label: "文字-圖片" },
    { value: "text-list", label: "文字-清單" },
  ],
  dataviz: [
    { value: "horizontal-bars", label: "橫條圖" },
    { value: "big-number", label: "大數字" },
    { value: "stats-row", label: "統計列" },
    { value: "comparison", label: "比較" },
  ],
  quote: [
    { value: "simple", label: "簡單" },
    { value: "card-overlay", label: "卡片" },
    { value: "fullscreen", label: "全螢幕" },
  ],
  "story-cards": [
    { value: "grid-3", label: "三欄" },
    { value: "grid-2", label: "雙欄" },
    { value: "single", label: "單張" },
  ],
  closing: [
    { value: "thank-you", label: "致謝" },
    { value: "cta", label: "行動號召" },
    { value: "summary", label: "摘要" },
  ],
};

/** Which content fields are relevant for each slideType */
function getRelevantFields(slideType: SlideType): string[] {
  switch (slideType) {
    case "cover": return ["title", "subtitle", "badge", "footnote"];
    case "section-divider": return ["title", "subtitle"];
    case "content": return ["title", "body", "items", "footnote"];
    case "two-column": return ["title", "columns", "footnote"];
    case "dataviz": return ["title", "items", "bigNumber", "stats", "columns", "footnote"];
    case "quote": return ["quote", "body"];
    case "story-cards": return ["title", "cards", "footnote"];
    case "closing": return ["title", "body", "footnote"];
  }
}

function ContentEditor({ slide }: { slide: SlideDefinition }) {
  const { updateSlideContent } = usePresentationsStore();
  const content = slide.content;
  const fields = getRelevantFields(content.slideType);

  const update = (updates: Partial<SlideContent>) => {
    updateSlideContent(slide.id, updates);
  };

  return (
    <div className="space-y-2">
      {fields.includes("title") && (
        <div>
          <label className="text-xs text-cy-muted block mb-1">標題</label>
          <input
            type="text"
            value={content.title ?? ""}
            onChange={(e) => update({ title: e.target.value })}
            className="w-full rounded-md bg-cy-input px-2 py-1.5 text-xs text-cy-text border border-cy-border focus:outline-none focus:border-cy-accent"
          />
        </div>
      )}

      {fields.includes("subtitle") && (
        <div>
          <label className="text-xs text-cy-muted block mb-1">副標題</label>
          <input
            type="text"
            value={content.subtitle ?? ""}
            onChange={(e) => update({ subtitle: e.target.value })}
            className="w-full rounded-md bg-cy-input px-2 py-1.5 text-xs text-cy-text border border-cy-border focus:outline-none focus:border-cy-accent"
          />
        </div>
      )}

      {fields.includes("badge") && (
        <div>
          <label className="text-xs text-cy-muted block mb-1">徽章</label>
          <input
            type="text"
            value={content.badge ?? ""}
            onChange={(e) => update({ badge: e.target.value })}
            placeholder="e.g. ANTHROPIC 2026"
            className="w-full rounded-md bg-cy-input px-2 py-1.5 text-xs text-cy-text border border-cy-border focus:outline-none focus:border-cy-accent placeholder:text-cy-muted/50"
          />
        </div>
      )}

      {fields.includes("body") && (
        <div>
          <label className="text-xs text-cy-muted block mb-1">內文</label>
          <textarea
            value={content.body ?? ""}
            onChange={(e) => update({ body: e.target.value })}
            rows={3}
            className="w-full rounded-md bg-cy-input px-2 py-1.5 text-xs text-cy-text border border-cy-border focus:outline-none focus:border-cy-accent resize-none"
          />
        </div>
      )}

      {fields.includes("items") && content.slideType !== "dataviz" && (
        <div>
          <label className="text-xs text-cy-muted block mb-1">項目（每行一個）</label>
          <textarea
            value={(content.items ?? []).map((item) => item.label + (item.desc ? ` — ${item.desc}` : "")).join("\n")}
            onChange={(e) => {
              const items = e.target.value.split("\n").map((line) => {
                const [label, ...descParts] = line.split(" — ");
                return { label: label.trim(), desc: descParts.join(" — ").trim() || undefined };
              });
              update({ items });
            }}
            rows={5}
            placeholder="項目一&#10;項目二 — 說明&#10;項目三"
            className="w-full rounded-md bg-cy-input px-2 py-1.5 text-xs text-cy-text border border-cy-border focus:outline-none focus:border-cy-accent resize-none placeholder:text-cy-muted/50"
          />
        </div>
      )}

      {fields.includes("quote") && (
        <div className="space-y-1.5">
          <label className="text-xs text-cy-muted block">引言</label>
          <textarea
            value={content.quote?.text ?? ""}
            onChange={(e) => update({ quote: { ...content.quote, text: e.target.value } })}
            rows={3}
            placeholder="引言內容"
            className="w-full rounded-md bg-cy-input px-2 py-1.5 text-xs text-cy-text border border-cy-border focus:outline-none focus:border-cy-accent resize-none placeholder:text-cy-muted/50"
          />
          <input
            type="text"
            value={content.quote?.author ?? ""}
            onChange={(e) => update({ quote: { ...content.quote, text: content.quote?.text ?? "", author: e.target.value } })}
            placeholder="作者"
            className="w-full rounded-md bg-cy-input px-2 py-1.5 text-xs text-cy-text border border-cy-border focus:outline-none focus:border-cy-accent placeholder:text-cy-muted/50"
          />
          <input
            type="text"
            value={content.quote?.source ?? ""}
            onChange={(e) => update({ quote: { ...content.quote, text: content.quote?.text ?? "", source: e.target.value } })}
            placeholder="出處"
            className="w-full rounded-md bg-cy-input px-2 py-1.5 text-xs text-cy-text border border-cy-border focus:outline-none focus:border-cy-accent placeholder:text-cy-muted/50"
          />
        </div>
      )}

      {fields.includes("footnote") && (
        <div>
          <label className="text-xs text-cy-muted block mb-1">註腳</label>
          <input
            type="text"
            value={content.footnote ?? ""}
            onChange={(e) => update({ footnote: e.target.value })}
            className="w-full rounded-md bg-cy-input px-2 py-1.5 text-xs text-cy-text border border-cy-border focus:outline-none focus:border-cy-accent"
          />
        </div>
      )}
    </div>
  );
}

interface SlideLayoutEditorProps {
  slide: SlideDefinition;
}

export function SlideLayoutEditor({ slide }: SlideLayoutEditorProps) {
  const { setSlideLayout, deleteSlide } = usePresentationsStore();
  const currentType = slide.content.slideType;
  const currentVariant = slide.content.variant;

  return (
    <div className="space-y-3">
      {/* SlideType selector */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-xs font-medium text-cy-muted">版面類型</label>
          <button
            onClick={() => deleteSlide(slide.id)}
            className="text-cy-error hover:text-cy-error/80 transition-colors"
            title="刪除投影片"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="grid grid-cols-4 gap-1">
          {SLIDE_TYPES.map((st) => (
            <button
              key={st.value}
              onClick={() => setSlideLayout(slide.id, st.value, VARIANTS[st.value][0].value)}
              className={`flex flex-col items-center gap-0.5 rounded-md px-1 py-1.5 text-center transition-colors ${
                currentType === st.value
                  ? "bg-cy-accent/15 border border-cy-accent/30 text-cy-accent"
                  : "bg-cy-input/30 border border-transparent hover:bg-cy-input/50 text-cy-text"
              }`}
            >
              <span className="text-sm">{st.icon}</span>
              <span className="text-[10px] leading-tight">{st.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Variant selector */}
      <div>
        <label className="text-xs text-cy-muted block mb-1">變體</label>
        <div className="flex flex-wrap gap-1">
          {VARIANTS[currentType].map((v) => (
            <button
              key={v.value}
              onClick={() => setSlideLayout(slide.id, currentType, v.value)}
              className={`rounded-md px-2 py-1 text-xs transition-colors ${
                currentVariant === v.value
                  ? "bg-cy-accent/15 text-cy-accent border border-cy-accent/30"
                  : "bg-cy-input/30 text-cy-muted border border-transparent hover:bg-cy-input/50"
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content editor */}
      <div className="border-t border-cy-border pt-2">
        <ContentEditor slide={slide} />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Update outline-editor.tsx**

Replace import and usage:

```typescript
// Change import from:
import { SlideBlockEditor } from "./slide-block-editor";
// To:
import { SlideLayoutEditor } from "./slide-layout-editor";

// Change JSX usage from:
<SlideBlockEditor slide={selectedSlide} />
// To:
<SlideLayoutEditor slide={selectedSlide} />

// Update header text from:
投影片 {session?.outline.slides.findIndex(...) + 1} 區塊
// To:
投影片 {session?.outline.slides.findIndex((s) => s.id === selectedSlideId)! + 1} 編輯
```

- [ ] **Step 3: Delete slide-block-editor.tsx**

```bash
git rm dashboard/src/components/skills/workstations/presentations/slide-block-editor.tsx
```

- [ ] **Step 4: Commit**

```
git add dashboard/src/components/skills/workstations/presentations/slide-layout-editor.tsx
git add dashboard/src/components/skills/workstations/presentations/outline-editor.tsx
git commit -m "feat(presentations): replace block editor with Layout Picker + content editor

8 slideType buttons, variant selector, and context-aware content
fields. Replaces coordinate-based block editing entirely."
```

---

## Task 10: Adapt Remaining Components

**Files:**
- Modify: `dashboard/src/components/skills/workstations/presentations/slide-thumbnail-list.tsx`
- Modify: `dashboard/src/components/skills/workstations/presentations/renderer-picker.tsx`
- Modify: `dashboard/src/components/skills/workstations/presentations/theme-picker.tsx`

- [ ] **Step 1: Update slide-thumbnail-list.tsx**

Change title extraction from blocks to content:

```typescript
// In SortableSlide, change:
const title = slide.blocks.find((b) => b.type === "heading")?.content ?? `投影片 ${index + 1}`;
// To:
const title = slide.content.title ?? `投影片 ${index + 1}`;
```

Update the `addSlide` call:

```typescript
// Change:
<button onClick={() => addSlide("content")}
// To:
<button onClick={() => addSlide("content")}
// (same call, but "content" is now SlideType instead of SlideLayout — signature changed in store)
```

Remove unused `SlideBlock` type references if any. Update the `SlideDefinition` import — it should still work since we kept the same interface name.

- [ ] **Step 2: Update renderer-picker.tsx**

Change `"revealjs"` to `"html"` in the RENDERERS array AND the fallback default:

```typescript
// In RENDERERS array, change:
{ id: "revealjs", ... }
// To:
{ id: "html", label: "HTML", description: "自建引擎" }

// Also change the fallback default (line ~14):
// From:
const current = session?.renderer ?? "revealjs";
// To:
const current = session?.renderer ?? "html";
```

- [ ] **Step 3: Update theme-picker.tsx**

Change `revealColors.accent` to `colors.accent`:

```typescript
// Change:
const accentColor = theme.revealColors.accent.startsWith("linear")
  ? "#888"
  : theme.revealColors.accent;
// To:
const accentColor = theme.colors.accent.startsWith("linear")
  ? "#888"
  : theme.colors.accent;
```

- [ ] **Step 4: Commit**

```
git add dashboard/src/components/skills/workstations/presentations/slide-thumbnail-list.tsx
git add dashboard/src/components/skills/workstations/presentations/renderer-picker.tsx
git add dashboard/src/components/skills/workstations/presentations/theme-picker.tsx
git commit -m "fix(presentations): adapt thumbnail list, renderer picker, theme picker to new model"
```

---

## Task 11: Build Verification & Manual Test

- [ ] **Step 1: Run TypeScript type check**

Run: `cd dashboard && npx tsc --noEmit`

Expected: Zero errors. If errors remain, fix each one (likely missed import paths or type mismatches).

- [ ] **Step 2: Run ESLint**

Run: `cd dashboard && npx next lint`

Expected: No new errors. Fix any that appear.

- [ ] **Step 3: Run dev server and verify in browser**

Run: `cd dashboard && npm run dev`

Manual checks via Playwright:
1. Navigate to presentations workstation
2. Select a theme, enter instructions, click generate
3. Verify slides render in the preview iframe
4. Check fragment animation (→ key reveals elements)
5. Check Layout Picker works (change slideType, variant)
6. Export HTML and open in browser — verify full-viewport slides

- [ ] **Step 4: Final commit if any fixes**

```
git add -A
git commit -m "fix(presentations): resolve build/lint issues from Slide Engine V2 migration"
```

---

## Task 12: Legacy Migration Banner

- [ ] **Step 1: Add migration detection in outline-editor.tsx or presentations-workstation.tsx**

If a session from localStorage still has the old `blocks` property:

```typescript
// In PresentationsWorkstation or OutlineEditor, check:
const isLegacy = session?.outline.slides.some((s: any) => 'blocks' in s);

// Show banner:
{isLegacy && (
  <div className="bg-cy-accent/10 border border-cy-accent/30 rounded-lg px-3 py-2 text-xs text-cy-accent">
    此簡報使用舊版引擎，請重新生成以使用新版排版系統
  </div>
)}
```

- [ ] **Step 2: Commit**

```
git add dashboard/src/components/skills/workstations/presentations/presentations-workstation.tsx
git commit -m "feat(presentations): add legacy format migration banner"
```
