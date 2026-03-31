# Slide Engine V3.5 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor slide templates into a plugin system, add 5 new slide types, and add per-slide speaker notes / image prompt generation.

**Architecture:** Each slide template becomes a self-contained plugin (render + CSS + field config + prompt metadata). A central registry collects all plugins. New templates plug in by adding a folder and registering. Per-slide generation uses existing refine route with new action types.

**Tech Stack:** Next.js, TypeScript, Zustand, Server-Sent Events, Claude Sonnet API

**Spec:** `docs/superpowers/specs/2026-03-30-slide-engine-v35-design.md`

---

## Phase 1: Plugin Architecture + Migrate Existing Templates

### Task 1: Create Plugin Type Definitions

**Files:**
- Create: `dashboard/src/lib/slide-templates/types.ts`

- [ ] **Step 1: Create the types file**

```ts
// dashboard/src/lib/slide-templates/types.ts
import type { SlideContent, SlideAnimation } from "@/stores/presentations-store";

export interface FieldConfig {
  key: string;
  type:
    | "text"
    | "textarea"
    | "items"
    | "cards"
    | "columns"
    | "images"
    | "image"
    | "icon-picker"
    | "highlight-lines";
  label: string;
  placeholder?: string;
  required?: boolean;
}

export interface VariantDef {
  id: string;
  label: string;
}

export interface TemplatePlugin {
  type: string;
  label: string;
  icon: string;
  variants: VariantDef[];
  defaultVariant: string;

  render: (slide: SlideContent, index: number, total: number) => string;
  styles: () => string;
  fields: FieldConfig[];

  promptDescription: string;
  contentFields: string;
}
```

- [ ] **Step 2: Verify file compiles**

Run: `cd dashboard && npx tsc --noEmit src/lib/slide-templates/types.ts 2>&1 | head -20`
Expected: No errors (or only unrelated import errors since store types haven't changed yet)

- [ ] **Step 3: Commit**

```bash
git add dashboard/src/lib/slide-templates/types.ts
git commit -m "feat(presentations): add TemplatePlugin and FieldConfig type definitions"
```

---

### Task 2: Create Shared Helpers

Extract `esc()`, `nl2br()`, `frag()`, `bgStyle()`, `overlayClass()`, `badgeHtml()`, `getImageSrc()`, `wrapWithLayout()` from current `slide-templates.ts` into a shared helpers file.

**Files:**
- Create: `dashboard/src/lib/slide-templates/helpers.ts`
- Read: `dashboard/src/lib/slide-templates.ts` (copy helper functions from lines 1-49)

- [ ] **Step 1: Create helpers.ts with extracted functions**

Copy the following functions from the top of `slide-templates.ts` into `helpers.ts`:
- `esc(str)` — HTML escape
- `nl2br(str)` — newline to `<br>`
- `frag(content, tag)` — wrap in `.fragment` div
- `bgStyle(slide)` — background image style
- `overlayClass(slide)` — overlay class name
- `badgeHtml(slide)` — badge position HTML
- `getImageSrc(image)` — extract image src
- `wrapWithLayout(html, layout)` — split/overlay layout wrapper

All functions keep their exact current signatures and logic. Add `export` to each.

```ts
// dashboard/src/lib/slide-templates/helpers.ts
import type { SlideContent } from "@/stores/presentations-store";

export function esc(str?: string): string {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function nl2br(str?: string): string {
  if (!str) return "";
  return esc(str).replace(/\n/g, "<br>");
}

export function frag(content: string, tag = "div"): string {
  return `<${tag} class="fragment">${content}</${tag}>`;
}

// ... (copy remaining functions exactly from slide-templates.ts)
```

- [ ] **Step 2: Commit**

```bash
git add dashboard/src/lib/slide-templates/helpers.ts
git commit -m "feat(presentations): extract shared template helpers"
```

---

### Task 3: Create Plugin Registry

**Files:**
- Create: `dashboard/src/lib/slide-templates/registry.ts`
- Create: `dashboard/src/lib/slide-templates/index.ts`

- [ ] **Step 1: Create registry.ts**

```ts
// dashboard/src/lib/slide-templates/registry.ts
import type { SlideContent, SlideAnimation } from "@/stores/presentations-store";
import type { TemplatePlugin, FieldConfig } from "./types";
import { wrapWithLayout } from "./helpers";

const PLUGINS = new Map<string, TemplatePlugin>();

export function registerTemplate(plugin: TemplatePlugin): void {
  PLUGINS.set(plugin.type, plugin);
}

export function getPlugin(type: string): TemplatePlugin | undefined {
  return PLUGINS.get(type);
}

export function getAllPlugins(): TemplatePlugin[] {
  return [...PLUGINS.values()];
}

export function getTemplateFields(type: string): FieldConfig[] {
  return PLUGINS.get(type)?.fields ?? [];
}

export function buildAllTemplateCSS(): string {
  return getAllPlugins()
    .map((p) => p.styles())
    .join("\n");
}

export function slideToHtml(
  slide: SlideContent,
  index: number,
  total: number,
  animation?: SlideAnimation
): string {
  const plugin = PLUGINS.get(slide.slideType);
  if (!plugin) return `<div class="slide"><p>Unknown type: ${slide.slideType}</p></div>`;

  let inner = plugin.render(slide, index, total);
  inner = wrapWithLayout(inner, slide, index);

  const entranceAttr = animation?.entrance
    ? ` data-entrance="${animation.entrance}"`
    : "";
  const fragAttr = animation?.fragmentStyle
    ? ` data-fragment="${animation.fragmentStyle}"`
    : "";
  const speedAttr = animation?.speed
    ? ` data-speed="${animation.speed}"`
    : "";
  const alignAttr = slide.textAlign
    ? ` data-text-align="${slide.textAlign}"`
    : "";

  return `<div class="slide ${slide.slideType}" data-index="${index}"${entranceAttr}${fragAttr}${speedAttr}${alignAttr}>${inner}</div>`;
}

export function buildPromptDecisionTree(): string {
  const structural = getAllPlugins().filter((p) =>
    ["cover", "closing", "section-divider"].includes(p.type)
  );
  const content = getAllPlugins().filter(
    (p) => !["cover", "closing", "section-divider"].includes(p.type)
  );

  let tree = "## Slide Type Selection (evaluate in order, stop at first match)\n\n";
  let i = 1;

  // Structural types first (hardcoded order)
  tree += `${i++}. First slide? → cover\n`;
  tree += `${i++}. Last slide? → closing\n`;
  tree += `${i++}. Section break? → section-divider\n`;

  // Content types use their promptDescription
  for (const p of content) {
    tree += `${i++}. ${p.promptDescription} → ${p.type}\n`;
  }

  tree += `\n## Variant Selection\n`;
  tree += `- Choose variant based on item count (e.g., 3 cards → grid-3)\n`;
  tree += `- Available variants per type:\n`;
  for (const p of getAllPlugins()) {
    tree += `  - ${p.type}: ${p.variants.map((v) => v.id).join(", ")}\n`;
  }

  return tree;
}

export function buildContentFieldsTable(): string {
  let table = "## Content Fields per Slide Type\n\n";
  for (const p of getAllPlugins()) {
    table += `### ${p.type}\n${p.contentFields}\n\n`;
  }
  return table;
}
```

- [ ] **Step 2: Create index.ts barrel export**

```ts
// dashboard/src/lib/slide-templates/index.ts
export { slideToHtml, getAllPlugins, getPlugin, getTemplateFields, buildAllTemplateCSS, buildPromptDecisionTree, buildContentFieldsTable } from "./registry";
export type { TemplatePlugin, FieldConfig, VariantDef } from "./types";
export { esc, nl2br, frag, bgStyle, overlayClass, badgeHtml, getImageSrc, wrapWithLayout } from "./helpers";
```

- [ ] **Step 3: Commit**

```bash
git add dashboard/src/lib/slide-templates/registry.ts dashboard/src/lib/slide-templates/index.ts
git commit -m "feat(presentations): add plugin registry with slideToHtml and prompt builders"
```

---

### Task 4: Migrate Cover Template (Proof of Concept)

Migrate the `cover` template to plugin format. This establishes the pattern for all other migrations.

**Files:**
- Create: `dashboard/src/lib/slide-templates/cover/index.ts`
- Create: `dashboard/src/lib/slide-templates/cover/render.ts`
- Create: `dashboard/src/lib/slide-templates/cover/styles.ts`
- Create: `dashboard/src/lib/slide-templates/cover/fields.ts`

- [ ] **Step 1: Create render.ts — copy renderCover() from slide-templates.ts**

```ts
// dashboard/src/lib/slide-templates/cover/render.ts
import type { SlideContent } from "@/stores/presentations-store";
import { esc, nl2br, frag, bgStyle, overlayClass, badgeHtml } from "../helpers";

export function renderCover(slide: SlideContent, index: number, total: number): string {
  // Copy exact logic from current slide-templates.ts renderCover function
  // Keep all fragment wrapping, badge positioning, background image support
  const bg = bgStyle(slide);
  const overlay = overlayClass(slide);
  const badge = badgeHtml(slide);

  return `
    <div class="cover-inner${overlay ? ` ${overlay}` : ""}"${bg ? ` style="${bg}"` : ""}>
      ${badge}
      ${slide.badge ? frag(`<div class="badge">${esc(slide.badge)}</div>`) : ""}
      ${slide.title ? frag(`<h1>${nl2br(slide.title)}</h1>`) : ""}
      ${slide.subtitle ? frag(`<p class="subtitle">${nl2br(slide.subtitle)}</p>`) : ""}
      ${slide.footnote ? frag(`<p class="footnote">${esc(slide.footnote)}</p>`) : ""}
    </div>`;
}
```

Note: Copy the EXACT current implementation from `slide-templates.ts`. The above is a simplified sketch — the actual code may differ. Read the file and copy precisely.

- [ ] **Step 2: Create styles.ts — extract cover CSS from slide-engine-css.ts**

```ts
// dashboard/src/lib/slide-templates/cover/styles.ts
export function coverStyles(): string {
  return `
    /* Cover slide */
    .cover { display: flex; align-items: center; justify-content: center; }
    .cover-inner {
      display: flex; flex-direction: column; align-items: center;
      justify-content: center; text-align: center;
      width: 100%; height: 100%; padding: 64px;
      background: var(--slide-bg); position: relative;
    }
    .cover h1 { font-size: var(--title-size); font-weight: 800; margin-bottom: 16px; }
    .cover .subtitle { font-size: var(--subtitle-size); color: var(--slide-secondary); }
    .cover .footnote { position: absolute; bottom: 32px; font-size: var(--small-size); color: var(--slide-muted); }
    .cover .badge {
      display: inline-block; padding: 6px 18px; border-radius: 999px;
      background: var(--slide-accent); color: #fff; font-size: var(--small-size);
      font-weight: 600; margin-bottom: 24px;
    }
  `;
}
```

Note: Extract the EXACT CSS for `.cover` from `slide-engine-css.ts`. The above is a sketch.

- [ ] **Step 3: Create fields.ts**

```ts
// dashboard/src/lib/slide-templates/cover/fields.ts
import type { FieldConfig } from "../types";

export const coverFields: FieldConfig[] = [
  { key: "title", type: "text", label: "標題", required: true },
  { key: "subtitle", type: "text", label: "副標題" },
  { key: "badge", type: "text", label: "標籤", placeholder: "例：2026 年度報告" },
  { key: "footnote", type: "text", label: "註腳" },
];
```

- [ ] **Step 4: Create index.ts — assemble the plugin**

```ts
// dashboard/src/lib/slide-templates/cover/index.ts
import type { TemplatePlugin } from "../types";
import { renderCover } from "./render";
import { coverStyles } from "./styles";
import { coverFields } from "./fields";

export const coverPlugin: TemplatePlugin = {
  type: "cover",
  label: "封面",
  icon: "🎯",
  variants: [
    { id: "gradient", label: "漸層" },
    { id: "image-bg", label: "背景圖" },
    { id: "clean", label: "簡潔" },
  ],
  defaultVariant: "gradient",

  render: renderCover,
  styles: coverStyles,
  fields: coverFields,

  promptDescription: "First slide of the presentation",
  contentFields: "title (string, required), subtitle (string), badge (string), footnote (string)",
};
```

- [ ] **Step 5: Register the cover plugin — update slide-templates/index.ts**

Add at the top of `index.ts`:
```ts
import { coverPlugin } from "./cover";
import { registerTemplate } from "./registry";

registerTemplate(coverPlugin);
```

- [ ] **Step 6: Verify cover plugin renders same output**

Run the dev server and check that cover slides still render correctly. Compare HTML output before/after.

- [ ] **Step 7: Commit**

```bash
git add dashboard/src/lib/slide-templates/cover/
git commit -m "feat(presentations): migrate cover template to plugin format"
```

---

### Task 5: Migrate Remaining 7 Templates

Follow the exact same pattern as Task 4 for each:
- `section-divider/` — render, styles, fields, index
- `content/` — render, styles, fields, index
- `two-column/` — render, styles, fields, index
- `dataviz/` — render, styles, fields, index
- `quote/` — render, styles, fields, index
- `story-cards/` — render, styles, fields, index
- `closing/` — render, styles, fields, index

**Files:**
- Create: 7 × 4 files = 28 files in `dashboard/src/lib/slide-templates/{type}/`
- Modify: `dashboard/src/lib/slide-templates/index.ts` — register all 7

- [ ] **Step 1: Create section-divider plugin**

For each plugin, the `fields.ts` defines which fields the editor shows:

```ts
// section-divider fields
[
  { key: "title", type: "text", label: "標題", required: true },
  { key: "subtitle", type: "text", label: "副標題" },
]
```

```ts
// content fields
[
  { key: "title", type: "text", label: "標題", required: true },
  { key: "body", type: "textarea", label: "內容" },
  { key: "items", type: "items", label: "列點項目" },
  { key: "footnote", type: "text", label: "註腳" },
]
```

```ts
// two-column fields
[
  { key: "title", type: "text", label: "標題", required: true },
  { key: "columns", type: "columns", label: "欄位內容" },
  { key: "footnote", type: "text", label: "註腳" },
]
```

```ts
// dataviz fields
[
  { key: "title", type: "text", label: "標題", required: true },
  { key: "items", type: "items", label: "資料項目" },
  { key: "bigNumber", type: "text", label: "大數字" },  // handled specially
  { key: "stats", type: "items", label: "統計" },
  { key: "columns", type: "columns", label: "比較欄位" },
  { key: "footnote", type: "text", label: "註腳" },
]
```

```ts
// quote fields
[
  { key: "quote", type: "textarea", label: "引言" },  // handled specially
  { key: "body", type: "textarea", label: "補充說明" },
]
```

```ts
// story-cards fields
[
  { key: "title", type: "text", label: "標題", required: true },
  { key: "cards", type: "cards", label: "卡片" },
  { key: "footnote", type: "text", label: "註腳" },
]
```

```ts
// closing fields
[
  { key: "title", type: "text", label: "標題", required: true },
  { key: "body", type: "textarea", label: "結語" },
  { key: "footnote", type: "text", label: "註腳" },
]
```

Each template's `promptDescription`:
- section-divider: `"Section break between major topics"`
- content: (empty string — this is the fallback/default)
- two-column: `"Source puts two concepts side by side (not good/bad comparison)"`
- dataviz: `"Source contains concrete numbers, statistics, or data"`
- quote: `"Source contains a direct quote or citation"`
- story-cards: `"Source has 2-3 parallel concepts needing longer descriptions"`
- closing: `"Last slide of the presentation"`

- [ ] **Step 2: Register all 7 plugins in index.ts**

```ts
// dashboard/src/lib/slide-templates/index.ts
import { registerTemplate } from "./registry";
import { coverPlugin } from "./cover";
import { sectionDividerPlugin } from "./section-divider";
import { contentPlugin } from "./content";
import { twoColumnPlugin } from "./two-column";
import { datavizPlugin } from "./dataviz";
import { quotePlugin } from "./quote";
import { storyCardsPlugin } from "./story-cards";
import { closingPlugin } from "./closing";

registerTemplate(coverPlugin);
registerTemplate(sectionDividerPlugin);
registerTemplate(contentPlugin);
registerTemplate(twoColumnPlugin);
registerTemplate(datavizPlugin);
registerTemplate(quotePlugin);
registerTemplate(storyCardsPlugin);
registerTemplate(closingPlugin);

export { slideToHtml, getAllPlugins, getPlugin, getTemplateFields, buildAllTemplateCSS, buildPromptDecisionTree, buildContentFieldsTable } from "./registry";
export type { TemplatePlugin, FieldConfig, VariantDef } from "./types";
export { esc, nl2br, frag, bgStyle, overlayClass, badgeHtml, getImageSrc, wrapWithLayout } from "./helpers";
```

- [ ] **Step 3: Commit**

```bash
git add dashboard/src/lib/slide-templates/
git commit -m "feat(presentations): migrate all 8 templates to plugin format"
```

---

### Task 6: Wire Up CSS — Replace Template CSS in slide-engine-css.ts

Remove template-specific CSS from `slide-engine-css.ts` and call `buildAllTemplateCSS()` instead.

**Files:**
- Modify: `dashboard/src/lib/slide-engine-css.ts`

- [ ] **Step 1: Import buildAllTemplateCSS**

```ts
import { buildAllTemplateCSS } from "./slide-templates";
```

- [ ] **Step 2: In buildCSS(), replace inline template CSS with plugin CSS**

Replace the section that has `.cover`, `.section-divider`, `.content-list`, etc. CSS with:

```ts
// Template-specific CSS (from plugins)
${buildAllTemplateCSS()}
```

Keep base CSS (variables, layout, typography, nav, animations, personality, print) in `slide-engine-css.ts`.

- [ ] **Step 3: Verify CSS output is equivalent**

Run dev server, open a presentation with various slide types, confirm styles are identical.

- [ ] **Step 4: Commit**

```bash
git add dashboard/src/lib/slide-engine-css.ts
git commit -m "refactor(presentations): delegate template CSS to plugin system"
```

---

### Task 7: Update Import Paths

Update all files that import from the old `slide-templates.ts` to use the new `slide-templates/` module.

**Files:**
- Modify: All files that import `slideToHtml` or helpers from `@/lib/slide-templates`
- Delete: `dashboard/src/lib/slide-templates.ts` (old monolithic file)

- [ ] **Step 1: Find all importers**

Run: `grep -r "slide-templates" dashboard/src/ --include="*.ts" --include="*.tsx" -l`

- [ ] **Step 2: Update imports**

The barrel export from `slide-templates/index.ts` uses the same names, so imports like:
```ts
import { slideToHtml } from "@/lib/slide-templates";
```
should continue to work without changes since the module resolution picks up `slide-templates/index.ts`.

- [ ] **Step 3: Delete old monolithic file**

```bash
rm dashboard/src/lib/slide-templates.ts
```

- [ ] **Step 4: Verify build**

Run: `cd dashboard && npm run build 2>&1 | tail -20`
Expected: Build succeeds

- [ ] **Step 5: Commit**

```bash
git add -A dashboard/src/lib/slide-templates*
git commit -m "refactor(presentations): remove monolithic slide-templates.ts, use plugin modules"
```

---

### Task 8: Update presentations-store.ts — New Types

Add the 5 new slide types and new SlideContent fields.

**Files:**
- Modify: `dashboard/src/stores/presentations-store.ts`

- [ ] **Step 1: Expand SlideType union**

```ts
type SlideType =
  | "cover" | "section-divider" | "content" | "two-column"
  | "dataviz" | "quote" | "story-cards" | "closing"
  | "image-showcase" | "icon-grid" | "statement" | "comparison" | "title-cards";
```

- [ ] **Step 2: Add new fields to SlideContent**

```ts
interface SlideContent {
  // ... existing fields ...

  // New for image-showcase
  images?: { url: string; caption?: string; fit?: "cover" | "contain" }[];

  // New for title-cards
  bannerImage?: { url: string; fit?: "cover" | "contain" };

  // New for statement
  highlightLines?: number[];
}
```

- [ ] **Step 3: Extend card type with optional imageUrl**

```ts
cards?: { title: string; body: string; icon?: string; imageUrl?: string }[];
```

- [ ] **Step 4: Update getDefaultVariant() to include new types**

```ts
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
    "image-showcase": "single",
    "icon-grid": "grid-3",
    statement: "centered",
    comparison: "vs-split",
    "title-cards": "banner-3",
  };
  return defaults[slideType] || "default";
}
```

- [ ] **Step 5: Verify build**

Run: `cd dashboard && npx tsc --noEmit 2>&1 | head -20`

- [ ] **Step 6: Commit**

```bash
git add dashboard/src/stores/presentations-store.ts
git commit -m "feat(presentations): add 5 new slide types and content fields to store"
```

---

### Task 9: Create FieldRenderer Component

A generic component that renders the right input based on `FieldConfig.type`.

**Files:**
- Create: `dashboard/src/components/skills/workstations/presentations/field-renderer.tsx`

- [ ] **Step 1: Create FieldRenderer**

```tsx
// dashboard/src/components/skills/workstations/presentations/field-renderer.tsx
"use client";

import { usePresentationsStore, type SlideDefinition } from "@/stores/presentations-store";
import type { FieldConfig } from "@/lib/slide-templates";

interface FieldRendererProps {
  field: FieldConfig;
  slide: SlideDefinition;
}

export function FieldRenderer({ field, slide }: FieldRendererProps) {
  const updateSlideContent = usePresentationsStore((s) => s.updateSlideContent);
  const content = slide.content;
  const slideId = slide.id;

  const inputClass =
    "w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-200 focus:border-blue-500 focus:outline-none";

  switch (field.type) {
    case "text":
      return (
        <div className="space-y-1">
          <label className="text-xs text-zinc-400">{field.label}</label>
          <input
            className={inputClass}
            value={(content[field.key as keyof typeof content] as string) || ""}
            placeholder={field.placeholder}
            onChange={(e) => updateSlideContent(slideId, { [field.key]: e.target.value })}
          />
        </div>
      );

    case "textarea":
      return (
        <div className="space-y-1">
          <label className="text-xs text-zinc-400">{field.label}</label>
          <textarea
            className={`${inputClass} min-h-[80px]`}
            value={(content[field.key as keyof typeof content] as string) || ""}
            placeholder={field.placeholder}
            onChange={(e) => updateSlideContent(slideId, { [field.key]: e.target.value })}
          />
        </div>
      );

    case "items":
      return <ItemsEditor field={field} slide={slide} />;

    case "cards":
      return <CardsEditor field={field} slide={slide} />;

    case "columns":
      return <ColumnsEditor field={field} slide={slide} />;

    case "images":
      return <ImagesEditor field={field} slide={slide} />;

    case "image":
      return <SingleImageEditor field={field} slide={slide} />;

    case "icon-picker":
      // Used within cards — handled by CardsEditor
      return null;

    case "highlight-lines":
      return <HighlightLinesEditor field={field} slide={slide} />;

    default:
      return null;
  }
}
```

Note: The sub-components (`ItemsEditor`, `CardsEditor`, `ColumnsEditor`, `ImagesEditor`, `SingleImageEditor`, `HighlightLinesEditor`) should be created in the same file. Extract the existing logic from `slide-layout-editor.tsx`'s `ContentEditor`:

- `ItemsEditor` — existing items editing (line-separated, " — " delimiter)
- `CardsEditor` — existing per-card icon/title/body inputs, plus optional imageUrl for title-cards
- `ColumnsEditor` — existing left/right column editors
- `ImagesEditor` — NEW: multi-image URL input (1-4 images) with fit selector per image
- `SingleImageEditor` — NEW: single image URL + fit selector (for bannerImage)
- `HighlightLinesEditor` — NEW: given title text, show checkbox per line for accent marking

The existing quote and bigNumber/stats special handling from `ContentEditor` should be integrated into the respective template's fields definition using appropriate field types.

- [ ] **Step 2: Commit**

```bash
git add dashboard/src/components/skills/workstations/presentations/field-renderer.tsx
git commit -m "feat(presentations): add FieldRenderer generic component for plugin fields"
```

---

### Task 10: Update SlideLayoutEditor to Use Plugins

Replace hardcoded `SLIDE_TYPES`, `VARIANTS`, and `ContentEditor` with plugin-driven rendering.

**Files:**
- Modify: `dashboard/src/components/skills/workstations/presentations/slide-layout-editor.tsx`

- [ ] **Step 1: Replace SLIDE_TYPES constant with plugin data**

```tsx
import { getAllPlugins, getPlugin, getTemplateFields } from "@/lib/slide-templates";
import { FieldRenderer } from "./field-renderer";

// Replace hardcoded SLIDE_TYPES with:
const SLIDE_TYPES = getAllPlugins().map((p) => ({
  value: p.type,
  label: p.label,
  icon: p.icon,
}));

// Replace hardcoded VARIANTS with:
function getVariants(slideType: string) {
  const plugin = getPlugin(slideType);
  return plugin?.variants.map((v) => ({ value: v.id, label: v.label })) ?? [];
}
```

- [ ] **Step 2: Replace ContentEditor with FieldRenderer loop**

```tsx
function ContentEditor({ slide }: { slide: SlideDefinition }) {
  const fields = getTemplateFields(slide.content.slideType);

  return (
    <div className="space-y-3 mt-4">
      {fields.map((field) => (
        <FieldRenderer key={field.key} field={field} slide={slide} />
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Update variant selector to use getVariants()**

Replace `VARIANTS[slideType]` with `getVariants(slideType)`.

- [ ] **Step 4: Verify all existing slide types still editable**

Run dev server, test editing cover, content, dataviz, quote, story-cards slides.

- [ ] **Step 5: Commit**

```bash
git add dashboard/src/components/skills/workstations/presentations/slide-layout-editor.tsx
git commit -m "refactor(presentations): use plugin registry for slide type/variant/field rendering"
```

---

### Task 11: Update Generate Route — Use Plugin Prompt Builders

Replace hardcoded slide-types table in the generate route with auto-generated content from plugins.

**Files:**
- Modify: `dashboard/src/app/api/presentations/generate/route.ts`

- [ ] **Step 1: Import prompt builders**

```ts
import { buildPromptDecisionTree, buildContentFieldsTable } from "@/lib/slide-templates";
```

- [ ] **Step 2: Replace hardcoded slide-types and content-fields sections**

In `SLIDE_OUTLINE_PROMPT`, replace the `<slide-types>` section with:
```ts
<slide-types>
${buildPromptDecisionTree()}
</slide-types>
```

Replace the `<content-fields>` section with:
```ts
<content-fields>
${buildContentFieldsTable()}
</content-fields>
```

- [ ] **Step 3: Update validation — accept new slide types**

The validation code that checks `slideType` against a valid set needs to use the plugin registry:

```ts
import { getPlugin } from "@/lib/slide-templates";

// Replace hardcoded valid types check with:
if (!getPlugin(s.content.slideType)) {
  s.content.slideType = "content";
}
```

- [ ] **Step 4: Commit**

```bash
git add dashboard/src/app/api/presentations/generate/route.ts
git commit -m "refactor(presentations): use plugin prompt builders in generate route"
```

---

### Task 12: Smoke Test Phase 1

Verify the plugin refactor produces identical behavior.

- [ ] **Step 1: Run build**

Run: `cd dashboard && npm run build`
Expected: Successful build

- [ ] **Step 2: Manual test — generate a presentation**

1. Open dashboard
2. Create a new presentation
3. Add source material
4. Generate
5. Verify all 8 slide types render correctly
6. Verify editing works for each type
7. Verify CSS looks the same

- [ ] **Step 3: Commit if any fixes needed**

---

## Phase 2: Add 5 New Templates

### Task 13: Add image-showcase Template

**Files:**
- Create: `dashboard/src/lib/slide-templates/image-showcase/index.ts`
- Create: `dashboard/src/lib/slide-templates/image-showcase/render.ts`
- Create: `dashboard/src/lib/slide-templates/image-showcase/styles.ts`
- Create: `dashboard/src/lib/slide-templates/image-showcase/fields.ts`
- Modify: `dashboard/src/lib/slide-templates/index.ts` — register

- [ ] **Step 1: Create render.ts**

```ts
// dashboard/src/lib/slide-templates/image-showcase/render.ts
import type { SlideContent } from "@/stores/presentations-store";
import { esc, nl2br, frag } from "../helpers";

export function renderImageShowcase(slide: SlideContent, index: number, total: number): string {
  const images = slide.images || [];
  const variant = slide.variant || "single";

  const titleHtml = slide.title ? frag(`<h2>${nl2br(slide.title)}</h2>`) : "";
  const subtitleHtml = slide.subtitle ? frag(`<p class="subtitle">${esc(slide.subtitle)}</p>`) : "";
  const footnoteHtml = slide.footnote ? frag(`<p class="footnote">${esc(slide.footnote)}</p>`) : "";

  const imageHtml = (img: { url: string; caption?: string; fit?: string }, cls = "") => {
    const fit = img.fit || "cover";
    return `<div class="showcase-img ${cls}">
      <img src="${esc(img.url)}" style="object-fit:${fit};" alt="" />
      ${img.caption ? `<span class="caption">${esc(img.caption)}</span>` : ""}
    </div>`;
  };

  let grid = "";
  switch (variant) {
    case "single":
      grid = images[0] ? imageHtml(images[0], "showcase-single") : "";
      break;
    case "duo":
      grid = `<div class="showcase-duo">${images.slice(0, 2).map((img) => imageHtml(img)).join("")}</div>`;
      break;
    case "trio":
      grid = `<div class="showcase-trio">
        ${images[0] ? imageHtml(images[0], "showcase-main") : ""}
        <div class="showcase-side">
          ${images.slice(1, 3).map((img) => imageHtml(img)).join("")}
        </div>
      </div>`;
      break;
    case "quad":
      grid = `<div class="showcase-quad">${images.slice(0, 4).map((img) => imageHtml(img)).join("")}</div>`;
      break;
  }

  return `<div class="image-showcase-inner">
    <div class="showcase-header">${titleHtml}${subtitleHtml}</div>
    ${frag(grid)}
    ${footnoteHtml}
  </div>`;
}
```

- [ ] **Step 2: Create styles.ts**

```ts
// dashboard/src/lib/slide-templates/image-showcase/styles.ts
export function imageShowcaseStyles(): string {
  return `
    .image-showcase { display:flex; align-items:center; justify-content:center; }
    .image-showcase-inner {
      display:flex; flex-direction:column; width:100%; height:100%;
      padding: var(--slide-padding, 48px); gap: 16px;
    }
    .showcase-header { text-align:left; }
    .showcase-header h2 { font-size: var(--title-size); margin-bottom:8px; }
    .showcase-header .subtitle { font-size: var(--subtitle-size); color: var(--slide-secondary); }

    .showcase-img {
      position:relative; border-radius: var(--slide-border-radius, 8px);
      overflow:hidden; background: var(--slide-card-bg);
    }
    .showcase-img img { width:100%; height:100%; display:block; }
    .showcase-img .caption {
      position:absolute; bottom:0; left:0; right:0;
      padding:6px 12px; font-size: var(--small-size);
      background: rgba(0,0,0,0.6); color:#fff;
    }

    .showcase-single { flex:1; min-height:0; }
    .showcase-single img { object-fit:cover; }

    .showcase-duo { display:grid; grid-template-columns:1fr 1fr; gap:12px; flex:1; min-height:0; }
    .showcase-duo .showcase-img { height:100%; }

    .showcase-trio { display:grid; grid-template-columns:1.2fr 0.8fr; gap:12px; flex:1; min-height:0; }
    .showcase-trio .showcase-main { height:100%; }
    .showcase-trio .showcase-side { display:flex; flex-direction:column; gap:12px; }
    .showcase-trio .showcase-side .showcase-img { flex:1; }

    .showcase-quad { display:grid; grid-template-columns:1fr 1fr; grid-template-rows:1fr 1fr; gap:12px; flex:1; min-height:0; }

    .image-showcase .footnote { font-size: var(--small-size); color: var(--slide-muted); }
  `;
}
```

- [ ] **Step 3: Create fields.ts**

```ts
// dashboard/src/lib/slide-templates/image-showcase/fields.ts
import type { FieldConfig } from "../types";

export const imageShowcaseFields: FieldConfig[] = [
  { key: "title", type: "text", label: "標題", required: true },
  { key: "subtitle", type: "text", label: "副標題" },
  { key: "images", type: "images", label: "圖片（1-4 張）" },
  { key: "footnote", type: "text", label: "註腳" },
];
```

- [ ] **Step 4: Create index.ts**

```ts
// dashboard/src/lib/slide-templates/image-showcase/index.ts
import type { TemplatePlugin } from "../types";
import { renderImageShowcase } from "./render";
import { imageShowcaseStyles } from "./styles";
import { imageShowcaseFields } from "./fields";

export const imageShowcasePlugin: TemplatePlugin = {
  type: "image-showcase",
  label: "圖片展示",
  icon: "🖼️",
  variants: [
    { id: "single", label: "單張" },
    { id: "duo", label: "雙張" },
    { id: "trio", label: "三張" },
    { id: "quad", label: "四張" },
  ],
  defaultVariant: "single",
  render: renderImageShowcase,
  styles: imageShowcaseStyles,
  fields: imageShowcaseFields,
  promptDescription: "Source needs to show screenshots, UI, or diagrams",
  contentFields: "title (required), subtitle, images[] ({url, caption?, fit?}), footnote",
};
```

- [ ] **Step 5: Register in index.ts**

Add import and `registerTemplate(imageShowcasePlugin)` to `slide-templates/index.ts`.

- [ ] **Step 6: Commit**

```bash
git add dashboard/src/lib/slide-templates/image-showcase/ dashboard/src/lib/slide-templates/index.ts
git commit -m "feat(presentations): add image-showcase template (single/duo/trio/quad)"
```

---

### Task 14: Add icon-grid Template

**Files:**
- Create: `dashboard/src/lib/slide-templates/icon-grid/` (index, render, styles, fields)
- Modify: `dashboard/src/lib/slide-templates/index.ts`

- [ ] **Step 1: Create render.ts**

```ts
export function renderIconGrid(slide: SlideContent, index: number, total: number): string {
  const cards = slide.cards || [];
  const variant = slide.variant || "grid-3";
  const gridClass = `icon-grid-${variant}`;

  const titleHtml = slide.title ? frag(`<h2>${nl2br(slide.title)}</h2>`) : "";
  const footnoteHtml = slide.footnote ? frag(`<p class="footnote">${esc(slide.footnote)}</p>`) : "";

  const cardsHtml = cards
    .map(
      (card) => frag(`<div class="icon-card">
        ${card.icon ? `<div class="icon-card-icon">${card.icon}</div>` : ""}
        <h3>${esc(card.title)}</h3>
        ${card.body ? `<p>${esc(card.body)}</p>` : ""}
      </div>`)
    )
    .join("");

  return `<div class="icon-grid-inner">
    ${titleHtml}
    <div class="${gridClass}">${cardsHtml}</div>
    ${footnoteHtml}
  </div>`;
}
```

- [ ] **Step 2: Create styles.ts**

CSS for `.icon-grid-inner`, `.icon-grid-grid-3` (1×3), `.icon-grid-grid-4` (2×2), `.icon-grid-grid-6` (2×3), `.icon-card` (centered icon + title + body).

- [ ] **Step 3: Create fields.ts, index.ts, register**

Fields: title (text), cards (cards with icon-picker), footnote (text).

Plugin metadata:
- promptDescription: `"Source has 3-6 features/steps, each needing only one sentence"`
- variants: grid-3, grid-4, grid-6

- [ ] **Step 4: Commit**

```bash
git add dashboard/src/lib/slide-templates/icon-grid/ dashboard/src/lib/slide-templates/index.ts
git commit -m "feat(presentations): add icon-grid template (grid-3/grid-4/grid-6)"
```

---

### Task 15: Add statement Template

**Files:**
- Create: `dashboard/src/lib/slide-templates/statement/` (index, render, styles, fields)
- Modify: `dashboard/src/lib/slide-templates/index.ts`

- [ ] **Step 1: Create render.ts**

```ts
export function renderStatement(slide: SlideContent, index: number, total: number): string {
  const variant = slide.variant || "centered";
  const lines = (slide.title || "").split("\n");
  const highlights = new Set(slide.highlightLines || []);

  const linesHtml = lines
    .map((line, i) => {
      const escaped = esc(line);
      if (variant === "highlight" && highlights.has(i)) {
        return `<span class="statement-highlight">${escaped}</span>`;
      }
      if (highlights.has(i)) {
        return `<span class="statement-accent">${escaped}</span>`;
      }
      return escaped;
    })
    .join("<br>");

  const bodyHtml = slide.body ? frag(`<p class="statement-body">${esc(slide.body)}</p>`) : "";

  return `<div class="statement-inner statement-${variant}">
    ${variant === "left-bold" ? '<div class="statement-bar"></div>' : ""}
    ${frag(`<div class="statement-text">${linesHtml}</div>`)}
    ${bodyHtml}
  </div>`;
}
```

- [ ] **Step 2: Create styles.ts**

CSS for:
- `.statement-inner` — full center/left alignment
- `.statement-centered` — text-align center, large font
- `.statement-left-bold` — text-align left, accent bar top
- `.statement-highlight` — accent background padding
- `.statement-accent` — accent color text
- `.statement-text` — font-size ~2.5em, font-weight 800, line-height 1.5
- `.statement-body` — smaller, muted color
- `.statement-bar` — 40px × 4px accent color bar

- [ ] **Step 3: Create fields.ts, index.ts, register**

Fields: title (textarea, "宣言文字"), body (text, "補充說明"), highlightLines (highlight-lines).

Plugin metadata:
- promptDescription: `"Source has one core claim/assertion with NO list of items"`
- variants: centered, left-bold, highlight

- [ ] **Step 4: Commit**

```bash
git add dashboard/src/lib/slide-templates/statement/ dashboard/src/lib/slide-templates/index.ts
git commit -m "feat(presentations): add statement template (centered/left-bold/highlight)"
```

---

### Task 16: Add comparison Template

**Files:**
- Create: `dashboard/src/lib/slide-templates/comparison/` (index, render, styles, fields)
- Modify: `dashboard/src/lib/slide-templates/index.ts`

- [ ] **Step 1: Create render.ts**

```ts
export function renderComparison(slide: SlideContent, index: number, total: number): string {
  const variant = slide.variant || "vs-split";
  const [left, right] = slide.columns || [{}, {}];

  const titleHtml = slide.title ? frag(`<h2>${nl2br(slide.title)}</h2>`) : "";

  const renderItems = (items?: { label: string; desc?: string }[]) =>
    (items || []).map((item) => `<li>${esc(item.label)}${item.desc ? ` — ${esc(item.desc)}` : ""}</li>`).join("");

  let leftLabel = "", rightLabel = "", leftIcon = "✗", rightIcon = "✓";
  if (variant === "before-after") {
    leftLabel = "BEFORE"; rightLabel = "AFTER"; leftIcon = ""; rightIcon = "";
  } else if (variant === "pros-cons") {
    leftLabel = "缺點"; rightLabel = "優點"; leftIcon = "👎"; rightIcon = "👍";
  } else {
    leftLabel = left.title || ""; rightLabel = right.title || "";
  }

  const vsBar = variant === "vs-split"
    ? `<div class="comparison-vs">VS</div>`
    : "";

  return `<div class="comparison-inner comparison-${variant}">
    ${titleHtml}
    <div class="comparison-columns">
      ${frag(`<div class="comparison-left">
        <div class="comparison-label">${leftIcon} ${esc(leftLabel)}</div>
        <ul>${renderItems(left.items)}</ul>
        ${left.body ? `<p>${nl2br(left.body)}</p>` : ""}
      </div>`)}
      ${vsBar}
      ${frag(`<div class="comparison-right">
        <div class="comparison-label">${rightIcon} ${esc(rightLabel)}</div>
        <ul>${renderItems(right.items)}</ul>
        ${right.body ? `<p>${nl2br(right.body)}</p>` : ""}
      </div>`)}
    </div>
  </div>`;
}
```

- [ ] **Step 2: Create styles.ts**

CSS for:
- `.comparison-inner` — flexbox column
- `.comparison-columns` — grid 2 columns (with optional VS center column for vs-split)
- `.comparison-vs-split .comparison-left` — red-tinted background, red border
- `.comparison-vs-split .comparison-right` — green-tinted background, green border
- `.comparison-vs` — centered VS badge
- `.comparison-before-after` — neutral borders, BEFORE/AFTER labels
- `.comparison-pros-cons` — accent left borders, card-style

- [ ] **Step 3: Create fields.ts, index.ts, register**

Fields: title (text), columns (columns).

Plugin metadata:
- promptDescription: `"Source explicitly compares good/bad, before/after, or pros/cons"`
- variants: vs-split, before-after, pros-cons

- [ ] **Step 4: Commit**

```bash
git add dashboard/src/lib/slide-templates/comparison/ dashboard/src/lib/slide-templates/index.ts
git commit -m "feat(presentations): add comparison template (vs-split/before-after/pros-cons)"
```

---

### Task 17: Add title-cards Template

**Files:**
- Create: `dashboard/src/lib/slide-templates/title-cards/` (index, render, styles, fields)
- Modify: `dashboard/src/lib/slide-templates/index.ts`

- [ ] **Step 1: Create render.ts**

```ts
export function renderTitleCards(slide: SlideContent, index: number, total: number): string {
  const variant = slide.variant || "banner-3";
  const cards = slide.cards || [];
  const banner = slide.bannerImage;

  const titleHtml = slide.title ? frag(`<h2>${nl2br(slide.title)}</h2>`) : "";

  const bannerHtml = banner?.url
    ? frag(`<div class="tc-banner">
        <img src="${esc(banner.url)}" style="object-fit:${banner.fit || "cover"};" alt="" />
      </div>`)
    : "";

  const cardsHtml = cards
    .map(
      (card) => frag(`<div class="tc-card">
        ${card.imageUrl ? `<div class="tc-card-img"><img src="${esc(card.imageUrl)}" alt="" /></div>` : ""}
        <div class="tc-card-body">
          <h3>${esc(card.title)}</h3>
          ${card.body ? `<p>${esc(card.body)}</p>` : ""}
        </div>
      </div>`)
    )
    .join("");

  const colCount = variant.replace("banner-", "");

  return `<div class="title-cards-inner">
    ${titleHtml}
    ${bannerHtml}
    <div class="tc-grid tc-grid-${colCount}">${cardsHtml}</div>
  </div>`;
}
```

- [ ] **Step 2: Create styles.ts**

CSS for:
- `.title-cards-inner` — flex column, gap
- `.tc-banner` — border-radius, overflow hidden, max-height 35%
- `.tc-grid` — CSS grid, gap
- `.tc-grid-2` — 2 columns
- `.tc-grid-3` — 3 columns
- `.tc-grid-4` — 4 columns
- `.tc-card` — card bg, border-radius, overflow hidden, flex column
- `.tc-card-img img` — width 100%, object-fit cover
- `.tc-card-body` — padding, title + body text

- [ ] **Step 3: Create fields.ts, index.ts, register**

Fields: title (text), bannerImage (image), cards (cards with imageUrl support).

Plugin metadata:
- promptDescription: `"Source has multiple sub-topics each with a representative image"`
- variants: banner-2, banner-3, banner-4

- [ ] **Step 4: Commit**

```bash
git add dashboard/src/lib/slide-templates/title-cards/ dashboard/src/lib/slide-templates/index.ts
git commit -m "feat(presentations): add title-cards template (banner-2/banner-3/banner-4)"
```

---

### Task 18: Update Refine Route — Accept New Slide Types

**Files:**
- Modify: `dashboard/src/app/api/presentations/refine/route.ts`

- [ ] **Step 1: Import getPlugin from slide-templates**

```ts
import { getPlugin } from "@/lib/slide-templates";
```

- [ ] **Step 2: Update available slideTypes in the refine prompt**

Replace the hardcoded `Available slideTypes: cover, section-divider, ...` line with dynamic list:

```ts
import { getAllPlugins } from "@/lib/slide-templates";

const availableTypes = getAllPlugins().map(p => p.type).join(", ");
// Use in prompt: `Available slideTypes: ${availableTypes}`
```

Also update the variants list dynamically:

```ts
const variantsList = getAllPlugins()
  .map(p => `- ${p.type}: ${p.variants.map(v => v.id).join(", ")}`)
  .join("\n");
```

- [ ] **Step 3: Update validation to use plugin registry**

```ts
if (!getPlugin(s.content.slideType)) {
  s.content.slideType = "content";
}
```

- [ ] **Step 4: Commit**

```bash
git add dashboard/src/app/api/presentations/refine/route.ts
git commit -m "feat(presentations): update refine route to accept new slide types"
```

---

### Task 19: Smoke Test Phase 2

- [ ] **Step 1: Build**

Run: `cd dashboard && npm run build`

- [ ] **Step 2: Generate a presentation and verify new types appear**

Test with source material that should trigger the new types:
- Statement text → statement slide
- Before/after comparison → comparison slide
- Feature list → icon-grid slide
- Screenshot reference → image-showcase (manual add)
- Multiple sub-topics → title-cards (manual add)

- [ ] **Step 3: Test manual slide add for each new type**

Add a slide, switch to each new type, verify:
- Editor shows correct fields
- Variant selector works
- HTML renders correctly

- [ ] **Step 4: Commit any fixes**

---

## Phase 3: Per-Slide Speaker Notes & Image Prompt Generation

### Task 20: Add Generation Buttons to Slide Editor

**Files:**
- Modify: `dashboard/src/components/skills/workstations/presentations/slide-layout-editor.tsx`

- [ ] **Step 1: Add per-slide generation buttons**

After the `ContentEditor` section, add:

```tsx
function SlideGenerationButtons({ slide }: { slide: SlideDefinition }) {
  const [notesLoading, setNotesLoading] = useState(false);
  const [imageLoading, setImageLoading] = useState(false);
  const updateSlideField = usePresentationsStore((s) => s.updateSlideField);
  const updateSlideContent = usePresentationsStore((s) => s.updateSlideContent);
  const activeSession = usePresentationsStore((s) => s.getActiveSession());

  const generateNotes = async () => {
    setNotesLoading(true);
    try {
      const res = await fetch("/api/presentations/refine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "generate-notes",
          slideId: slide.id,
          slideContent: slide.content,
          presentationTitle: activeSession?.outline.title || "",
        }),
      });
      const data = await res.json();
      if (data.speakerNotes) {
        updateSlideField(slide.id, "speakerNotes", data.speakerNotes);
      }
    } finally {
      setNotesLoading(false);
    }
  };

  const generateImagePrompt = async () => {
    setImageLoading(true);
    try {
      const res = await fetch("/api/presentations/refine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "generate-image-prompt",
          slideId: slide.id,
          slideContent: slide.content,
          presentationTitle: activeSession?.outline.title || "",
        }),
      });
      const data = await res.json();
      if (data.imagePrompt) {
        updateSlideContent(slide.id, { imagePrompt: data.imagePrompt });
      }
    } finally {
      setImageLoading(false);
    }
  };

  return (
    <div className="flex gap-2 mt-4 pt-4 border-t border-zinc-700">
      <button
        onClick={generateNotes}
        disabled={notesLoading}
        className="flex-1 px-3 py-2 text-xs bg-zinc-700 hover:bg-zinc-600 rounded text-zinc-300 disabled:opacity-50"
      >
        {notesLoading ? "生成中..." : slide.speakerNotes ? "📝 重新生成講稿" : "📝 生成講稿"}
      </button>
      <button
        onClick={generateImagePrompt}
        disabled={imageLoading}
        className="flex-1 px-3 py-2 text-xs bg-zinc-700 hover:bg-zinc-600 rounded text-zinc-300 disabled:opacity-50"
      >
        {imageLoading ? "生成中..." : slide.content.imagePrompt ? "🖼️ 重新生成圖片" : "🖼️ 生成圖片提示"}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Show generated content below buttons**

```tsx
{slide.speakerNotes && (
  <div className="mt-2 space-y-1">
    <label className="text-xs text-zinc-400">講稿</label>
    <textarea
      className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-200 min-h-[60px]"
      value={slide.speakerNotes}
      onChange={(e) => updateSlideField(slide.id, "speakerNotes", e.target.value)}
    />
  </div>
)}
{slide.content.imagePrompt && (
  <div className="mt-2 space-y-1">
    <label className="text-xs text-zinc-400">圖片提示</label>
    <input
      className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-200"
      value={slide.content.imagePrompt}
      onChange={(e) => updateSlideContent(slide.id, { imagePrompt: e.target.value })}
    />
  </div>
)}
```

- [ ] **Step 3: Wire buttons into SlideLayoutEditor**

Add `<SlideGenerationButtons slide={slide} />` at the bottom of the `SlideLayoutEditor` component, after the `ContentEditor`.

- [ ] **Step 4: Commit**

```bash
git add dashboard/src/components/skills/workstations/presentations/slide-layout-editor.tsx
git commit -m "feat(presentations): add per-slide generate buttons for notes and image prompt"
```

---

### Task 21: Add Generate Actions to Refine Route

**Files:**
- Modify: `dashboard/src/app/api/presentations/refine/route.ts`

- [ ] **Step 1: Handle new action types in POST handler**

At the top of the POST handler, check for `action` field:

```ts
const { outline, message, targetSlideId, claudeSessionId, action, slideId, slideContent, presentationTitle } = await req.json();

// New: per-slide generation actions
if (action === "generate-notes" || action === "generate-image-prompt") {
  return handlePerSlideGeneration(action, slideId, slideContent, presentationTitle);
}

// Existing refine logic continues below...
```

- [ ] **Step 2: Implement handlePerSlideGeneration**

```ts
async function handlePerSlideGeneration(
  action: "generate-notes" | "generate-image-prompt",
  slideId: string,
  slideContent: SlideContent,
  presentationTitle: string
): Promise<Response> {
  const slideJson = JSON.stringify(slideContent, null, 2);

  const prompt = action === "generate-notes"
    ? `You are a presentation speaking coach. Based on this slide, write what the presenter should SAY while this slide is on screen.

<slide>${slideJson}</slide>
<presentation-title>${presentationTitle}</presentation-title>

Rules:
- NEVER repeat text already on the slide
- Write supplementary explanations, background stories, extended details
- Include transition phrases (e.g., "接下來我們來看...")
- Include audience interaction cues (e.g., "大家有沒有遇過...")
- Natural, conversational tone — like talking to people
- Length: 3-5 sentences
- Language: match the slide content language

Respond with ONLY the speaker notes text. No JSON. No formatting.`

    : `Based on this slide's topic, generate an English image description suitable for a background or supplementary image.

<slide>${slideJson}</slide>
<presentation-title>${presentationTitle}</presentation-title>

Style: professional, modern, clean. No text elements.
Abstract or contextual imagery that supports the slide's message.
One paragraph, 2-3 sentences.

Respond with ONLY the image description. No JSON. No formatting.`;

  const result = await provider.generateText(prompt, { model: "sonnet" });

  const responseData = action === "generate-notes"
    ? { slideId, speakerNotes: result.trim() }
    : { slideId, imagePrompt: result.trim() };

  return Response.json(responseData);
}
```

Note: If `provider.generateText()` doesn't exist, use `provider.stream()` and collect the full text. Check the actual provider API.

- [ ] **Step 3: Commit**

```bash
git add dashboard/src/app/api/presentations/refine/route.ts
git commit -m "feat(presentations): add per-slide generate-notes and generate-image-prompt actions"
```

---

### Task 22: Final Smoke Test

- [ ] **Step 1: Build**

Run: `cd dashboard && npm run build`

- [ ] **Step 2: Test per-slide generation**

1. Open a presentation in editing mode
2. Click "生成講稿" on a content slide → verify notes are supplementary, not repetitive
3. Click "生成圖片提示" on a section-divider → verify prompt is generated
4. Edit the generated text → verify it persists
5. Click "重新生成講稿" → verify it regenerates

- [ ] **Step 3: Test new templates end-to-end**

1. Generate a new presentation with diverse source material
2. Verify AI uses new template types (statement, comparison, icon-grid)
3. Manually add image-showcase and title-cards slides
4. Add images, verify layout variants work

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat(presentations): slide engine v3.5 complete — plugin system + 5 new templates + per-slide generation"
```
