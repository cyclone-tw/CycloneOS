# Slide Engine V3.1 Batch 1 — Visual Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add theme personality system, glass/solid card toggle, custom parameter sliders, and responsive layout to the slide engine.

**Architecture:** Extend the existing CSS-variable-driven theme system with a `personality` property per theme. `buildCSS()` takes new `SlideSettings` (card style + custom params) and generates personality CSS vars, glass/solid card styles, and scaled typography. A new `<StyleSettingsPanel>` component in the workstation provides toggles and sliders that update the store, triggering iframe re-render.

**Tech Stack:** TypeScript, React, Zustand (persisted store), CSS generation (string templates), Next.js

**Spec:** `docs/superpowers/specs/2026-03-28-slide-engine-v31-design.md` (Batch 1 sections only)

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `dashboard/src/lib/presentation-themes.ts` | Modify | Add `ThemePersonality` interface + `personality` to all 26 themes |
| `dashboard/src/lib/slide-engine-css.ts` | Rewrite | Responsive layout + personality CSS vars + glass CSS + custom scale params |
| `dashboard/src/lib/presentations-utils.ts` | Modify | `outlineToHtml()` accepts `SlideSettings`, injects classes |
| `dashboard/src/stores/presentations-store.ts` | Modify | Add `SlideSettings`, `CustomParams` interfaces + store methods |
| `dashboard/src/components/presentations/style-settings-panel.tsx` | Create | Glass toggle + 4 sliders + reset button |
| `dashboard/src/components/presentations/presentations-workstation.tsx` | Modify | Import and render `<StyleSettingsPanel>` in left panel |

---

### Task 1: Add types and store methods

**Files:**
- Modify: `dashboard/src/stores/presentations-store.ts`

- [ ] **Step 1: Add CustomParams and SlideSettings interfaces**

After the `BackgroundImage` interface (around line 42), add:

```typescript
export interface CustomParams {
  titleScale: number;    // 0.8 ~ 1.4, default 1.0
  bodyScale: number;     // 0.8 ~ 1.4
  cardScale: number;     // 0.8 ~ 1.4
  spacingScale: number;  // 0.8 ~ 1.4
}

export interface SlideSettings {
  cardStyle: "solid" | "glass";
  customParams: CustomParams;
}

export const DEFAULT_CUSTOM_PARAMS: CustomParams = {
  titleScale: 1.0,
  bodyScale: 1.0,
  cardScale: 1.0,
  spacingScale: 1.0,
};

export const DEFAULT_SLIDE_SETTINGS: SlideSettings = {
  cardStyle: "solid",
  customParams: DEFAULT_CUSTOM_PARAMS,
};
```

- [ ] **Step 2: Add `slideSettings` to `PresentationSession`**

In the `PresentationSession` interface (line ~78-91), add after `selectedSlideId`:

```typescript
slideSettings: SlideSettings;
```

- [ ] **Step 3: Add store methods for slideSettings**

In the `PresentationsState` interface (line ~95-135), add after `setTheme`:

```typescript
setCardStyle: (style: "solid" | "glass") => void;
setCustomParam: (key: keyof CustomParams, value: number) => void;
resetCustomParams: () => void;
```

- [ ] **Step 4: Implement the store methods**

In the store implementation, add after `setTheme` method (line ~343-349):

```typescript
setCardStyle: (style) =>
  set(
    updateSession(get, (s) => ({
      ...s,
      slideSettings: { ...s.slideSettings, cardStyle: style },
    }))
  ),

setCustomParam: (key, value) =>
  set(
    updateSession(get, (s) => ({
      ...s,
      slideSettings: {
        ...s.slideSettings,
        customParams: { ...s.slideSettings.customParams, [key]: value },
      },
    }))
  ),

resetCustomParams: () =>
  set(
    updateSession(get, (s) => ({
      ...s,
      slideSettings: {
        ...s.slideSettings,
        customParams: { ...DEFAULT_CUSTOM_PARAMS },
      },
    }))
  ),
```

- [ ] **Step 5: Add default slideSettings to createSession**

In the `createSession` method (line ~176-197), add `slideSettings: { ...DEFAULT_SLIDE_SETTINGS }` to the new session object.

- [ ] **Step 6: Verify TypeScript compiles**

Run: `cd dashboard && npx tsc --noEmit 2>&1 | head -30`
Expected: No errors (or only pre-existing ones)

- [ ] **Step 7: Commit**

```bash
git add dashboard/src/stores/presentations-store.ts
git commit -m "feat(presentations): add SlideSettings + CustomParams to store"
```

---

### Task 2: Add ThemePersonality to presentation-themes.ts

**Files:**
- Modify: `dashboard/src/lib/presentation-themes.ts`

- [ ] **Step 1: Add ThemePersonality interface**

After the `PresentationTheme` interface (line ~41), add:

```typescript
export interface ThemePersonality {
  titleAlign: "center" | "left" | "top-left";
  contentDensity: "compact" | "normal" | "spacious";
  borderRadius: number;
  shadowDepth: "none" | "subtle" | "medium" | "heavy";
  borderStyle: "none" | "thin" | "thick" | "accent-left";
  decorations: {
    titleUnderline: "none" | "thin" | "thick" | "accent-gradient";
    sectionDivider: "none" | "line" | "dots" | "geometric";
    accentShape: "none" | "circle" | "square" | "triangle" | "wave";
  };
  cardEffect: "solid" | "glass";
}
```

- [ ] **Step 2: Add `personality` to PresentationTheme interface**

In the `PresentationTheme` interface, add after `feloThemeId?`:

```typescript
personality: ThemePersonality;
```

- [ ] **Step 3: Add personality to consulting themes (mckinsey, bcg, deloitte, accenture)**

For each consulting theme object, add the `personality` property. Example for McKinsey:

```typescript
personality: {
  titleAlign: "left",
  contentDensity: "normal",
  borderRadius: 2,
  shadowDepth: "subtle",
  borderStyle: "thin",
  decorations: {
    titleUnderline: "thin",
    sectionDivider: "line",
    accentShape: "none",
  },
  cardEffect: "solid",
},
```

BCG:
```typescript
personality: {
  titleAlign: "left",
  contentDensity: "normal",
  borderRadius: 4,
  shadowDepth: "subtle",
  borderStyle: "accent-left",
  decorations: {
    titleUnderline: "thin",
    sectionDivider: "line",
    accentShape: "none",
  },
  cardEffect: "solid",
},
```

Deloitte:
```typescript
personality: {
  titleAlign: "left",
  contentDensity: "normal",
  borderRadius: 4,
  shadowDepth: "medium",
  borderStyle: "thin",
  decorations: {
    titleUnderline: "thick",
    sectionDivider: "line",
    accentShape: "none",
  },
  cardEffect: "solid",
},
```

Accenture:
```typescript
personality: {
  titleAlign: "left",
  contentDensity: "normal",
  borderRadius: 6,
  shadowDepth: "subtle",
  borderStyle: "thin",
  decorations: {
    titleUnderline: "accent-gradient",
    sectionDivider: "line",
    accentShape: "none",
  },
  cardEffect: "solid",
},
```

- [ ] **Step 4: Add personality to startup themes (yc-minimal, sequoia, dark-tech)**

YC Minimal:
```typescript
personality: {
  titleAlign: "left",
  contentDensity: "spacious",
  borderRadius: 8,
  shadowDepth: "none",
  borderStyle: "none",
  decorations: {
    titleUnderline: "none",
    sectionDivider: "none",
    accentShape: "none",
  },
  cardEffect: "solid",
},
```

Sequoia:
```typescript
personality: {
  titleAlign: "left",
  contentDensity: "normal",
  borderRadius: 4,
  shadowDepth: "subtle",
  borderStyle: "thin",
  decorations: {
    titleUnderline: "thin",
    sectionDivider: "line",
    accentShape: "none",
  },
  cardEffect: "solid",
},
```

Dark Tech:
```typescript
personality: {
  titleAlign: "center",
  contentDensity: "normal",
  borderRadius: 12,
  shadowDepth: "medium",
  borderStyle: "thin",
  decorations: {
    titleUnderline: "none",
    sectionDivider: "none",
    accentShape: "triangle",
  },
  cardEffect: "glass",
},
```

- [ ] **Step 5: Add personality to modern themes (glass, bento, neobrutal, editorial, + others)**

Glass:
```typescript
personality: {
  titleAlign: "center",
  contentDensity: "spacious",
  borderRadius: 16,
  shadowDepth: "none",
  borderStyle: "thin",
  decorations: {
    titleUnderline: "accent-gradient",
    sectionDivider: "none",
    accentShape: "none",
  },
  cardEffect: "glass",
},
```

Bento:
```typescript
personality: {
  titleAlign: "left",
  contentDensity: "compact",
  borderRadius: 12,
  shadowDepth: "subtle",
  borderStyle: "thin",
  decorations: {
    titleUnderline: "none",
    sectionDivider: "line",
    accentShape: "none",
  },
  cardEffect: "solid",
},
```

Neobrutalism:
```typescript
personality: {
  titleAlign: "left",
  contentDensity: "normal",
  borderRadius: 0,
  shadowDepth: "heavy",
  borderStyle: "thick",
  decorations: {
    titleUnderline: "none",
    sectionDivider: "none",
    accentShape: "square",
  },
  cardEffect: "solid",
},
```

Editorial:
```typescript
personality: {
  titleAlign: "left",
  contentDensity: "spacious",
  borderRadius: 2,
  shadowDepth: "none",
  borderStyle: "none",
  decorations: {
    titleUnderline: "thick",
    sectionDivider: "line",
    accentShape: "none",
  },
  cardEffect: "solid",
},
```

For any other modern themes in the codebase, use:
```typescript
personality: {
  titleAlign: "center",
  contentDensity: "normal",
  borderRadius: 12,
  shadowDepth: "subtle",
  borderStyle: "thin",
  decorations: {
    titleUnderline: "thin",
    sectionDivider: "line",
    accentShape: "none",
  },
  cardEffect: "solid",
},
```

- [ ] **Step 6: Add personality to minimal themes (swiss, soft, mono-bold)**

Swiss:
```typescript
personality: {
  titleAlign: "center",
  contentDensity: "spacious",
  borderRadius: 0,
  shadowDepth: "none",
  borderStyle: "thin",
  decorations: {
    titleUnderline: "none",
    sectionDivider: "line",
    accentShape: "none",
  },
  cardEffect: "solid",
},
```

Soft:
```typescript
personality: {
  titleAlign: "center",
  contentDensity: "spacious",
  borderRadius: 20,
  shadowDepth: "subtle",
  borderStyle: "none",
  decorations: {
    titleUnderline: "none",
    sectionDivider: "none",
    accentShape: "none",
  },
  cardEffect: "solid",
},
```

Monochrome Bold:
```typescript
personality: {
  titleAlign: "center",
  contentDensity: "normal",
  borderRadius: 4,
  shadowDepth: "medium",
  borderStyle: "thick",
  decorations: {
    titleUnderline: "none",
    sectionDivider: "none",
    accentShape: "none",
  },
  cardEffect: "solid",
},
```

- [ ] **Step 7: Add personality to data + education + asian + institutional + creative themes**

Dashboard:
```typescript
personality: {
  titleAlign: "left",
  contentDensity: "compact",
  borderRadius: 8,
  shadowDepth: "medium",
  borderStyle: "thin",
  decorations: {
    titleUnderline: "none",
    sectionDivider: "line",
    accentShape: "none",
  },
  cardEffect: "glass",
},
```

Infographic:
```typescript
personality: {
  titleAlign: "center",
  contentDensity: "normal",
  borderRadius: 12,
  shadowDepth: "subtle",
  borderStyle: "none",
  decorations: {
    titleUnderline: "none",
    sectionDivider: "dots",
    accentShape: "circle",
  },
  cardEffect: "solid",
},
```

Academic:
```typescript
personality: {
  titleAlign: "left",
  contentDensity: "normal",
  borderRadius: 4,
  shadowDepth: "subtle",
  borderStyle: "thin",
  decorations: {
    titleUnderline: "thick",
    sectionDivider: "line",
    accentShape: "none",
  },
  cardEffect: "solid",
},
```

Classroom:
```typescript
personality: {
  titleAlign: "left",
  contentDensity: "spacious",
  borderRadius: 12,
  shadowDepth: "subtle",
  borderStyle: "accent-left",
  decorations: {
    titleUnderline: "none",
    sectionDivider: "dots",
    accentShape: "none",
  },
  cardEffect: "solid",
},
```

Takahashi:
```typescript
personality: {
  titleAlign: "center",
  contentDensity: "spacious",
  borderRadius: 0,
  shadowDepth: "none",
  borderStyle: "none",
  decorations: {
    titleUnderline: "none",
    sectionDivider: "none",
    accentShape: "none",
  },
  cardEffect: "solid",
},
```

Zen:
```typescript
personality: {
  titleAlign: "center",
  contentDensity: "spacious",
  borderRadius: 12,
  shadowDepth: "none",
  borderStyle: "none",
  decorations: {
    titleUnderline: "none",
    sectionDivider: "dots",
    accentShape: "none",
  },
  cardEffect: "solid",
},
```

Gov Official:
```typescript
personality: {
  titleAlign: "left",
  contentDensity: "normal",
  borderRadius: 4,
  shadowDepth: "subtle",
  borderStyle: "thin",
  decorations: {
    titleUnderline: "thick",
    sectionDivider: "line",
    accentShape: "none",
  },
  cardEffect: "solid",
},
```

Trust (Institutional):
```typescript
personality: {
  titleAlign: "left",
  contentDensity: "normal",
  borderRadius: 8,
  shadowDepth: "subtle",
  borderStyle: "accent-left",
  decorations: {
    titleUnderline: "thin",
    sectionDivider: "line",
    accentShape: "none",
  },
  cardEffect: "solid",
},
```

Aurora:
```typescript
personality: {
  titleAlign: "center",
  contentDensity: "spacious",
  borderRadius: 20,
  shadowDepth: "medium",
  borderStyle: "none",
  decorations: {
    titleUnderline: "accent-gradient",
    sectionDivider: "none",
    accentShape: "wave",
  },
  cardEffect: "glass",
},
```

Noir:
```typescript
personality: {
  titleAlign: "center",
  contentDensity: "normal",
  borderRadius: 8,
  shadowDepth: "medium",
  borderStyle: "thin",
  decorations: {
    titleUnderline: "thin",
    sectionDivider: "line",
    accentShape: "none",
  },
  cardEffect: "solid",
},
```

- [ ] **Step 8: Verify TypeScript compiles**

Run: `cd dashboard && npx tsc --noEmit 2>&1 | head -30`
Expected: No errors. Every theme object must have a `personality` property.

- [ ] **Step 9: Commit**

```bash
git add dashboard/src/lib/presentation-themes.ts
git commit -m "feat(presentations): add ThemePersonality to all 26 themes"
```

---

### Task 3: Rewrite buildCSS with responsive layout + personality + glass + custom params

**Files:**
- Modify: `dashboard/src/lib/slide-engine-css.ts`

This is the largest task. The function signature changes to accept `SlideSettings` and the theme's `personality`. The entire CSS output is regenerated with responsive units, personality-driven CSS variables, glass/solid card styles, and scaled typography.

- [ ] **Step 1: Update buildCSS signature**

Change the function signature:

```typescript
import type { PresentationTheme, ThemePersonality } from "./presentation-themes";
import type { CustomParams, SlideSettings } from "@/stores/presentations-store";

export function buildCSS(
  theme: PresentationTheme,
  settings?: SlideSettings
): string {
```

- [ ] **Step 2: Add helper functions at the top of the file**

Before `buildCSS`, add helpers for computing personality CSS values:

```typescript
function shadowValue(depth: ThemePersonality["shadowDepth"], isDark: boolean): string {
  const alpha = isDark ? 0.4 : 0.1;
  switch (depth) {
    case "none": return "none";
    case "subtle": return `0 1px 3px rgba(0,0,0,${alpha})`;
    case "medium": return `0 4px 12px rgba(0,0,0,${alpha * 1.5})`;
    case "heavy": return `0 8px 24px rgba(0,0,0,${alpha * 2})`;
  }
}

function borderValue(style: ThemePersonality["borderStyle"], accent: string, isDark: boolean): string {
  const base = isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)";
  switch (style) {
    case "none": return "none";
    case "thin": return `1px solid ${base}`;
    case "thick": return `2px solid ${base}`;
    case "accent-left": return `3px solid ${accent}`;
  }
}

function densityPadding(density: ThemePersonality["contentDensity"]): string {
  switch (density) {
    case "compact": return "3.5%";
    case "normal": return "5%";
    case "spacious": return "7%";
  }
}

function scaledPx(basePx: number, scale: number): number {
  return Math.round(basePx * scale);
}
```

- [ ] **Step 3: Rewrite the CSS variables section**

Inside `buildCSS`, after extracting theme values, build the personality-aware `:root` block:

```typescript
const p = theme.personality;
const params = settings?.customParams ?? {
  titleScale: 1, bodyScale: 1, cardScale: 1, spacingScale: 1,
};
const cardStyle = settings?.cardStyle ?? p.cardEffect;
const pad = densityPadding(p.contentDensity);

// Scaled font sizes
const titleSize = scaledPx(48, params.titleScale);
const subtitleSize = scaledPx(28, params.titleScale);
const bodySize = scaledPx(22, params.bodyScale);
const smallSize = scaledPx(16, params.bodyScale);
const cardPad = scaledPx(28, params.cardScale);
const gapSize = scaledPx(24, params.spacingScale);
```

Then in the CSS template string, replace the `:root` block:

```css
:root {
  /* Colors */
  --slide-bg: ${bg};
  --slide-text: ${text};
  --slide-accent: ${accent};
  --slide-secondary: ${secondary};
  --slide-muted: ${muted};
  --slide-card-bg: ${cardBg};
  /* Fonts */
  --font-heading: ${theme.fonts.heading};
  --font-body: ${theme.fonts.body};
  --font-mono: ${theme.fonts.mono ?? "monospace"};
  /* Bar colors */
  ${barColors.map((c, i) => `--bar-${i}: ${c};`).join("\n  ")}
  /* Personality */
  --slide-title-align: ${p.titleAlign === "top-left" ? "left" : p.titleAlign};
  --slide-border-radius: ${p.borderRadius}px;
  --slide-card-radius: ${p.borderRadius}px;
  --slide-shadow: ${shadowValue(p.shadowDepth, theme.isDark)};
  --slide-border: ${borderValue(p.borderStyle, accent, theme.isDark)};
  /* Scaled sizes */
  --title-size: ${titleSize}px;
  --subtitle-size: ${subtitleSize}px;
  --body-size: ${bodySize}px;
  --small-size: ${smallSize}px;
  --card-padding: ${cardPad}px;
  --gap-size: ${gapSize}px;
  --slide-padding: ${pad};
}
```

- [ ] **Step 4: Rewrite responsive layout CSS**

Replace the viewport/canvas/slide-inner section:

```css
*, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }

body {
  background: ${bg.startsWith("linear") ? bg : bg};
  overflow: hidden;
}

.viewport {
  width: 100vw;
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.slide-deck {
  width: 1280px;
  height: 720px;
  position: relative;
  transform-origin: center center;
  overflow: hidden;
}

.slide {
  position: absolute;
  inset: 0;
  display: none;
  overflow: hidden;
  background: ${bg.startsWith("linear") ? bg : `var(--slide-bg)`};
  color: var(--slide-text);
}

.slide.active { display: flex; }

.slide-inner {
  width: 100%;
  height: 100%;
  padding: var(--slide-padding);
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: var(--gap-size);
  position: relative;
}
```

- [ ] **Step 5: Rewrite typography CSS with scaled sizes**

```css
/* Typography */
.slide h1 { font-family: var(--font-heading); font-size: ${scaledPx(64, params.titleScale)}px; font-weight: 800; line-height: 1.1; text-align: var(--slide-title-align); }
.slide h2 { font-family: var(--font-heading); font-size: var(--title-size); font-weight: 700; line-height: 1.2; text-align: var(--slide-title-align); }
.slide h3 { font-family: var(--font-heading); font-size: var(--subtitle-size); font-weight: 600; line-height: 1.3; text-align: var(--slide-title-align); }
.slide p, .slide li { font-family: var(--font-body); font-size: var(--body-size); line-height: 1.6; }
.slide .subtitle { font-size: var(--subtitle-size); opacity: 0.85; }
.slide .footnote { font-size: var(--small-size); opacity: 0.6; }
.slide .badge { font-size: ${scaledPx(14, params.bodyScale)}px; text-transform: uppercase; letter-spacing: 2px; opacity: 0.7; }
.slide .body-text { font-size: var(--body-size); line-height: 1.7; }
.slide .item-desc { font-size: ${scaledPx(18, params.bodyScale)}px; opacity: 0.8; line-height: 1.5; }
```

- [ ] **Step 6: Rewrite card styles with personality + glass**

```css
/* Cards — personality-driven */
.story-card, .stat-card, .content-card, .quote-card {
  border-radius: var(--slide-card-radius);
  padding: var(--card-padding);
  box-shadow: var(--slide-shadow);
  ${p.borderStyle === "accent-left"
    ? `border-left: var(--slide-border); border-top: none; border-right: none; border-bottom: none;`
    : `border: var(--slide-border);`}
}

/* Solid card bg */
.card-solid .story-card, .card-solid .stat-card,
.card-solid .content-card, .card-solid .quote-card {
  background: var(--slide-card-bg);
}

/* Glass card bg */
.card-glass .story-card, .card-glass .stat-card,
.card-glass .content-card, .card-glass .quote-card {
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  background: ${theme.isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.04)"};
  border: 1px solid ${theme.isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)"};
}

/* Bullet items with card style */
.content .slide-inner > .fragment {
  background: var(--slide-card-bg);
  border-radius: var(--slide-card-radius);
  padding: ${scaledPx(16, params.cardScale)}px ${scaledPx(24, params.cardScale)}px;
  border-left: 4px solid var(--slide-accent);
  box-shadow: var(--slide-shadow);
}
.card-glass .content .slide-inner > .fragment {
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  background: ${theme.isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.03)"};
  border-left: 4px solid var(--slide-accent);
}
```

- [ ] **Step 7: Add decoration CSS**

After the card styles, add decoration CSS based on personality:

```typescript
// Inside the template literal, conditionally add decorations
const decorCSS = buildDecorationCSS(p, theme);
```

Add a new helper function before `buildCSS`:

```typescript
function buildDecorationCSS(p: ThemePersonality, theme: PresentationTheme): string {
  const parts: string[] = [];
  const accent = theme.colors.accent;
  const secondary = theme.colors.secondary ?? theme.colors.accent;

  // Title underline
  if (p.decorations.titleUnderline !== "none") {
    const height = p.decorations.titleUnderline === "thick" ? "4px" : p.decorations.titleUnderline === "accent-gradient" ? "3px" : "2px";
    const bg = p.decorations.titleUnderline === "accent-gradient"
      ? `linear-gradient(90deg, ${accent}, ${secondary})`
      : accent;
    parts.push(`
.slide h2::after {
  content: '';
  display: block;
  width: 60px;
  height: ${height};
  background: ${bg};
  margin-top: 12px;
  border-radius: 2px;
  ${p.titleAlign === "center" ? "margin-left: auto; margin-right: auto;" : ""}
}
`);
  }

  // Section divider
  if (p.decorations.sectionDivider === "line") {
    parts.push(`
.section-divider .slide-inner::after {
  content: '';
  position: absolute;
  bottom: 10%;
  ${p.titleAlign === "center" ? "left: 35%; right: 35%;" : "left: 5%; width: 80px;"}
  height: 2px;
  background: ${accent};
  opacity: 0.3;
}
`);
  } else if (p.decorations.sectionDivider === "dots") {
    parts.push(`
.section-divider .slide-inner::after {
  content: '● ● ●';
  position: absolute;
  bottom: 10%;
  ${p.titleAlign === "center" ? "left: 0; right: 0; text-align: center;" : "left: 5%;"}
  font-size: 8px;
  letter-spacing: 6px;
  color: ${accent};
  opacity: 0.5;
}
`);
  } else if (p.decorations.sectionDivider === "geometric") {
    parts.push(`
.section-divider .slide-inner::after {
  content: '';
  position: absolute;
  bottom: 8%;
  right: 8%;
  width: 40px;
  height: 40px;
  border: 2px solid ${accent};
  opacity: 0.15;
  transform: rotate(45deg);
}
`);
  }

  // Accent shape
  if (p.decorations.accentShape === "triangle") {
    parts.push(`
.cover .slide-inner::before {
  content: '';
  position: absolute;
  top: -40px;
  right: -40px;
  width: 200px;
  height: 200px;
  background: ${accent};
  opacity: 0.08;
  clip-path: polygon(100% 0, 0 0, 100% 100%);
  pointer-events: none;
}
`);
  } else if (p.decorations.accentShape === "circle") {
    parts.push(`
.cover .slide-inner::before {
  content: '';
  position: absolute;
  top: -60px;
  right: -60px;
  width: 180px;
  height: 180px;
  background: ${accent};
  opacity: 0.06;
  border-radius: 50%;
  pointer-events: none;
}
`);
  } else if (p.decorations.accentShape === "square") {
    parts.push(`
.cover .slide-inner::before {
  content: '';
  position: absolute;
  bottom: -20px;
  left: -20px;
  width: 120px;
  height: 120px;
  background: ${accent};
  opacity: 0.08;
  pointer-events: none;
}
.closing .slide-inner::before {
  content: '';
  position: absolute;
  top: -20px;
  right: -20px;
  width: 120px;
  height: 120px;
  background: ${accent};
  opacity: 0.08;
  pointer-events: none;
}
`);
  } else if (p.decorations.accentShape === "wave") {
    parts.push(`
.slide-inner::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 6px;
  background: linear-gradient(90deg, ${accent}, ${secondary}, ${accent});
  border-radius: 3px;
  pointer-events: none;
}
`);
  }

  return parts.join("\n");
}
```

Include `${decorCSS}` in the buildCSS template string, after the card styles.

- [ ] **Step 8: Keep remaining CSS sections (dataviz, two-column, quote, story-cards, etc.)**

Update the remaining sections to use CSS variables instead of hardcoded values:
- Replace hardcoded `border-radius: 14px` → `border-radius: var(--slide-card-radius)`
- Replace hardcoded `padding: 28px` → `padding: var(--card-padding)`
- Replace hardcoded `gap: 24px` → `gap: var(--gap-size)`
- Replace hardcoded font sizes → use `var(--title-size)`, `var(--body-size)`, etc.
- Two-column layout: use `display: grid; grid-template-columns: 1fr 1fr; gap: var(--gap-size);`
- Story cards grid: use `display: grid; grid-template-columns: repeat(auto-fit, minmax(${scaledPx(280, params.cardScale)}px, 1fr)); gap: var(--gap-size);`

Keep the dataviz bar chart CSS (transition: width 0.8s), stats-row, big-number, comparison sections functionally identical but with var-based sizing.

- [ ] **Step 9: Keep fragment + background image + nav sections unchanged**

The fragment CSS stays as-is (Batch 2 will modify it). Background image support stays as-is. Navigation CSS stays as-is (positioned outside the canvas).

- [ ] **Step 10: Verify TypeScript compiles**

Run: `cd dashboard && npx tsc --noEmit 2>&1 | head -30`
Expected: No errors

- [ ] **Step 11: Commit**

```bash
git add dashboard/src/lib/slide-engine-css.ts
git commit -m "feat(slide-engine): responsive layout + personality CSS + glass + custom params"
```

---

### Task 4: Update outlineToHtml to accept SlideSettings

**Files:**
- Modify: `dashboard/src/lib/presentations-utils.ts`

- [ ] **Step 1: Update imports and function signature**

```typescript
import type { SlideOutline, SlideSettings } from "@/stores/presentations-store";
// ... existing imports ...

export function outlineToHtml(
  outline: SlideOutline,
  theme?: PresentationTheme,
  settings?: SlideSettings
): string {
```

- [ ] **Step 2: Pass settings to buildCSS**

Change line where buildCSS is called:

```typescript
const css = buildCSS(resolvedTheme, settings);
```

- [ ] **Step 3: Add card-style and dark/light class to slide-deck**

In the HTML template, update the slide-deck div:

```typescript
const cardClass = settings?.cardStyle ?? resolvedTheme.personality.cardEffect;
const darkLightClass = resolvedTheme.isDark ? "dark" : "light";

// In the HTML string:
`<div class="slide-deck card-${cardClass} ${darkLightClass}">`
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `cd dashboard && npx tsc --noEmit 2>&1 | head -30`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add dashboard/src/lib/presentations-utils.ts
git commit -m "feat(presentations): outlineToHtml accepts SlideSettings"
```

---

### Task 5: Update SlidePreview to pass settings

**Files:**
- Modify: `dashboard/src/components/presentations/slide-preview.tsx`

- [ ] **Step 1: Read slideSettings from store and pass to outlineToHtml**

In the component, where `outlineToHtml` is called, add `slideSettings`:

```typescript
const { slideSettings } = usePresentationsStore();
// or get from session:
const session = usePresentationsStore((s) => s.getActiveSession());

// Where html is computed:
const html = useMemo(
  () => outlineToHtml(session.outline, resolvedTheme, session.slideSettings),
  [session.outline, resolvedTheme, session.slideSettings]
);
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd dashboard && npx tsc --noEmit 2>&1 | head -30`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add dashboard/src/components/presentations/slide-preview.tsx
git commit -m "feat(presentations): pass slideSettings to outlineToHtml in preview"
```

---

### Task 6: Create StyleSettingsPanel component

**Files:**
- Create: `dashboard/src/components/presentations/style-settings-panel.tsx`

- [ ] **Step 1: Create the component file**

```tsx
"use client";

import { RotateCcw } from "lucide-react";
import { usePresentationsStore } from "@/stores/presentations-store";
import type { CustomParams } from "@/stores/presentations-store";

function ParamSlider({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-cy-muted w-16 shrink-0">{label}</span>
      <input
        type="range"
        min={0.8}
        max={1.4}
        step={0.05}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="flex-1 h-1 accent-cy-accent"
      />
      <span className="text-xs text-cy-muted w-10 text-right tabular-nums">
        {Math.round(value * 100)}%
      </span>
    </div>
  );
}

export function StyleSettingsPanel() {
  const session = usePresentationsStore((s) => s.getActiveSession());
  const setCardStyle = usePresentationsStore((s) => s.setCardStyle);
  const setCustomParam = usePresentationsStore((s) => s.setCustomParam);
  const resetCustomParams = usePresentationsStore((s) => s.resetCustomParams);

  if (!session) return null;

  const { cardStyle, customParams } = session.slideSettings;

  return (
    <div className="border-t border-cy-border/30 pt-3 mt-3">
      <h4 className="text-xs font-medium text-cy-muted uppercase tracking-wider mb-3">
        樣式調整
      </h4>

      {/* Card style toggle */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-xs text-cy-muted w-16 shrink-0">卡片風格</span>
        <div className="flex rounded-md overflow-hidden border border-cy-border/30">
          <button
            onClick={() => setCardStyle("solid")}
            className={`px-3 py-1 text-xs transition-colors ${
              cardStyle === "solid"
                ? "bg-cy-accent/20 text-cy-accent"
                : "text-cy-muted hover:bg-cy-input/50"
            }`}
          >
            實色
          </button>
          <button
            onClick={() => setCardStyle("glass")}
            className={`px-3 py-1 text-xs transition-colors ${
              cardStyle === "glass"
                ? "bg-cy-accent/20 text-cy-accent"
                : "text-cy-muted hover:bg-cy-input/50"
            }`}
          >
            玻璃
          </button>
        </div>
      </div>

      {/* Sliders */}
      <div className="space-y-2">
        <ParamSlider
          label="標題大小"
          value={customParams.titleScale}
          onChange={(v) => setCustomParam("titleScale", v)}
        />
        <ParamSlider
          label="內文大小"
          value={customParams.bodyScale}
          onChange={(v) => setCustomParam("bodyScale", v)}
        />
        <ParamSlider
          label="卡片大小"
          value={customParams.cardScale}
          onChange={(v) => setCustomParam("cardScale", v)}
        />
        <ParamSlider
          label="間距"
          value={customParams.spacingScale}
          onChange={(v) => setCustomParam("spacingScale", v)}
        />
      </div>

      {/* Reset button */}
      <button
        onClick={resetCustomParams}
        className="mt-3 flex items-center gap-1.5 text-xs text-cy-muted hover:text-cy-accent transition-colors"
      >
        <RotateCcw className="h-3 w-3" />
        重設為主題預設
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd dashboard && npx tsc --noEmit 2>&1 | head -30`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add dashboard/src/components/presentations/style-settings-panel.tsx
git commit -m "feat(presentations): add StyleSettingsPanel component"
```

---

### Task 7: Wire StyleSettingsPanel into workstation

**Files:**
- Modify: `dashboard/src/components/presentations/presentations-workstation.tsx`

- [ ] **Step 1: Import StyleSettingsPanel**

Add import:

```typescript
import { StyleSettingsPanel } from "./style-settings-panel";
```

- [ ] **Step 2: Add panel to the left sidebar**

In the left panel section (around line 117-119), add `<StyleSettingsPanel />` below the existing panel:

```tsx
{/* Left panel */}
<div style={{ width: leftWidth }} className="shrink-0 overflow-y-auto border-r border-cy-border/20">
  {isEditing ? <OutlineEditor /> : <PresentationsSourcePanel />}
  {isEditing && <div className="px-4 pb-4"><StyleSettingsPanel /></div>}
</div>
```

The `StyleSettingsPanel` only shows when editing (not when configuring).

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd dashboard && npx tsc --noEmit 2>&1 | head -30`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add dashboard/src/components/presentations/presentations-workstation.tsx
git commit -m "feat(presentations): add style settings panel to workstation"
```

---

### Task 8: Build verification + visual test

**Files:** None (verification only)

- [ ] **Step 1: Run Next.js build**

Run: `cd dashboard && npm run build 2>&1 | tail -20`
Expected: Build succeeds with no errors

- [ ] **Step 2: Start dev server and visual test with Playwright**

Start the dev server, navigate to the presentations workstation, generate a test presentation, and verify:

1. The slide preview renders with personality-driven styles (rounded corners, shadows, decorations)
2. The glass/solid toggle changes card appearance
3. The sliders change font sizes and spacing in real time
4. Different themes produce visually distinct slides

Use Playwright browser to take screenshots for verification.

- [ ] **Step 3: Test with multiple themes**

Switch between at least 3 visually different themes (e.g., McKinsey, Glass, Neobrutalism) and verify each looks distinct:
- McKinsey: left-aligned, thin underline, sharp corners, subtle shadow
- Glass: centered, gradient underline, large radius, glass cards by default
- Neobrutalism: left-aligned, no underline, square corners, heavy shadow, thick borders

- [ ] **Step 4: Test glass toggle**

Toggle between solid and glass on a dark theme and a light theme. Verify:
- Glass mode: cards have visible blur effect and semi-transparent backgrounds
- Solid mode: cards have opaque backgrounds
- Toggle is instant (no page reload)

- [ ] **Step 5: Test custom params**

Move each slider to extremes (80% and 140%) and verify:
- Title text visibly changes size
- Body text visibly changes size
- Card padding visibly changes
- Spacing between elements visibly changes
- Reset button returns all to 100%

- [ ] **Step 6: Final commit**

If any fixes were needed during testing, commit them:

```bash
git add -A
git commit -m "fix(presentations): visual adjustments from V3.1 Batch 1 testing"
```
