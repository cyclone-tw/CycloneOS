# Slide Engine V3.5 — Template Plugin + 5 New Templates + Per-Slide Generation

**Date:** 2026-03-30
**Status:** Draft
**Previous:** v3.4 (LLM provider + per-slide controls + truncation repair)

## Summary

Three changes:
1. Refactor slide templates from monolithic files into a **Template Plugin system** — each template is a self-contained module
2. Add **5 new slide types** (image-showcase, icon-grid, statement, comparison, title-cards) with flexible variants
3. Add **per-slide generation** for speaker notes and image prompts via refine route

Builder feature (from-scratch slides) was evaluated and dropped — existing post-generation editing already covers this use case.

---

## 1. Template Plugin Architecture

### Current State (Monolithic)

```
lib/slide-templates.ts    ← all 8 render functions in one file (~600 lines)
lib/slide-engine-css.ts   ← all CSS in one file (~800 lines)
slide-layout-editor.tsx   ← if/switch chains for each template's fields
```

### Target State (Plugin System)

```
lib/slide-templates/
  registry.ts              ← plugin registry + slideToHtml() + buildAllTemplateCSS()
  types.ts                 ← TemplatePlugin interface + FieldConfig types
  helpers.ts               ← shared: esc(), nl2br(), frag(), bgStyle(), badgeHtml()

  cover/
    index.ts               ← exports TemplatePlugin object
    render.ts              ← renderCover()
    styles.ts              ← CSS string for cover
    fields.ts              ← FieldConfig[] for editor

  section-divider/
    index.ts, render.ts, styles.ts, fields.ts

  content/
    index.ts, render.ts, styles.ts, fields.ts

  two-column/
    index.ts, render.ts, styles.ts, fields.ts

  dataviz/
    index.ts, render.ts, styles.ts, fields.ts

  quote/
    index.ts, render.ts, styles.ts, fields.ts

  story-cards/
    index.ts, render.ts, styles.ts, fields.ts

  closing/
    index.ts, render.ts, styles.ts, fields.ts

  image-showcase/           ← NEW
    index.ts, render.ts, styles.ts, fields.ts

  icon-grid/                ← NEW
    index.ts, render.ts, styles.ts, fields.ts

  statement/                ← NEW
    index.ts, render.ts, styles.ts, fields.ts

  comparison/               ← NEW
    index.ts, render.ts, styles.ts, fields.ts

  title-cards/              ← NEW
    index.ts, render.ts, styles.ts, fields.ts
```

### TemplatePlugin Interface

```ts
interface TemplatePlugin {
  type: SlideType;
  label: string;              // Display name: "圖片展示"
  icon: string;               // Editor icon: "🖼️"
  variants: { id: string; label: string }[];
  defaultVariant: string;

  // Core
  render: (slide: SlideContent, index: number, total: number) => string;
  styles: () => string;
  fields: FieldConfig[];

  // AI prompt generation
  promptDescription: string;  // "When to use" for decision tree
  contentFields: string;      // Field descriptions for AI
}
```

### FieldConfig Interface

```ts
interface FieldConfig {
  key: string;               // Maps to SlideContent field
  type: 'text' | 'textarea' | 'items' | 'cards' | 'columns'
      | 'images' | 'image' | 'icon-picker' | 'highlight-lines';
  label: string;             // "標題", "圖片"
  placeholder?: string;
  required?: boolean;
}
```

### Registry

```ts
// registry.ts
const PLUGINS = new Map<SlideType, TemplatePlugin>();

export function registerTemplate(plugin: TemplatePlugin): void;
export function getPlugin(type: SlideType): TemplatePlugin | undefined;
export function getAllPlugins(): TemplatePlugin[];

export function slideToHtml(
  slide: SlideContent, index: number, total: number, animation?: SlideAnimation
): string;

export function buildAllTemplateCSS(): string;
// Collects styles() from all registered plugins

export function getTemplateFields(type: SlideType): FieldConfig[];

export function buildPromptTable(): string;
// Auto-generates the slide-types decision tree from all plugins' promptDescription

export function buildContentFieldsTable(): string;
// Auto-generates field descriptions from all plugins' contentFields
```

### Shared Helpers (extracted from current slide-templates.ts)

```ts
// helpers.ts — used by all render functions
export function esc(s: string): string;           // HTML escape
export function nl2br(s: string): string;         // newline → <br>
export function frag(html: string): string;        // wrap in .fragment div
export function bgStyle(bg: BackgroundImage): string;
export function badgeHtml(badge: string, pos: BadgePosition): string;
export function wrapWithLayout(inner: string, slide: SlideContent, index: number): string;
```

### CSS Architecture

```ts
// slide-engine-css.ts changes:
// - Base CSS (variables, layout, nav, animations, personality) stays here
// - Template-specific CSS moves to each plugin's styles.ts
// - buildCSS() calls buildAllTemplateCSS() to collect all plugin CSS

export function buildCSS(theme: PresentationTheme, settings?: SlideSettings): string {
  return [
    buildBaseCSS(theme, settings),       // variables, layout, nav
    buildPersonalityCSS(theme),          // decorations, borders, shadows
    buildAnimationCSS(settings),         // keyframes, transitions
    buildAllTemplateCSS(),               // from plugins
    buildCustomParamsCSS(settings),      // scaling overrides
  ].join('\n');
}
```

### Editor Changes

```tsx
// slide-layout-editor.tsx
// Replace ContentEditor's if/switch chains with:

const fields = getTemplateFields(slide.content.slideType);

return fields.map(field => (
  <FieldRenderer key={field.key} field={field} slide={slide} />
));
```

`FieldRenderer` is a generic component that renders the right input based on `field.type`:
- `text` → single-line input
- `textarea` → multi-line input
- `items` → line-separated editor with label—description split
- `cards` → per-card icon/title/body inputs
- `columns` → left/right column editors
- `images` → multi-image URL input (1-4), with fit selector (cover/contain)
- `image` → single image URL input with fit selector
- `icon-picker` → emoji/icon selector
- `highlight-lines` → checkbox per line for accent marking

---

## 2. Five New Slide Types

### 2.1 image-showcase

**Purpose:** Display 1-4 images with title. For product screenshots, architecture diagrams, dashboard previews.

**Variants:**
| Variant | Layout | When |
|---------|--------|------|
| single | 1 large image, 60-70% area | 1 image |
| duo | 2 images side by side | 2 images |
| trio | 1 large left + 2 small right | 3 images |
| quad | 2×2 grid | 4 images |

**Fields:**
- `title` (text, required)
- `subtitle` (text)
- `images` (images, 1-4, each with url + caption? + fit?)
- `footnote` (text)

**New SlideContent fields:**
```ts
images?: { url: string; caption?: string; fit?: 'cover' | 'contain' }[];
```

**AI trigger:** Source mentions showing screens, screenshots, or visual demonstrations.

### 2.2 icon-grid

**Purpose:** Central title + 3-6 icon cards in a grid. For feature overviews, service listings, process steps.

**Variants:**
| Variant | Layout | When |
|---------|--------|------|
| grid-3 | 1×3 row | 3 items |
| grid-4 | 2×2 grid | 4 items |
| grid-6 | 2×3 grid | 5-6 items |

**Fields:**
- `title` (text, required)
- `cards` (cards with icon-picker, reuses existing `{title, body, icon?}[]`)
- `footnote` (text)

**No new SlideContent fields** — reuses `cards[]`.

**AI trigger:** Source has 3-6 features/steps, each needing only one sentence.

### 2.3 statement

**Purpose:** 2-3 lines of large impactful text. For core beliefs, turning points, key messages.

**Variants:**
| Variant | Style | Description |
|---------|-------|-------------|
| centered | Center-aligned | Cleanest, most direct |
| left-bold | Left-aligned + accent bar | More forceful feel |
| highlight | Center + accent background on key line | Highlighter marker effect |

**Fields:**
- `title` (textarea, required — this IS the statement text, multi-line)
- `body` (text — optional attribution or supplementary note)
- `highlightLines` (highlight-lines — which lines get accent color)

**New SlideContent fields:**
```ts
highlightLines?: number[];  // 0-indexed line numbers to accent
```

**AI trigger:** Source has one core claim/assertion with no list of items.

### 2.4 comparison

**Purpose:** Two-column explicit comparison. For before/after, pros/cons, old vs new.

**Variants:**
| Variant | Style | Description |
|---------|-------|-------------|
| vs-split | Red ✗ left, Green ✓ right, VS divider | Strong confrontational feel |
| before-after | BEFORE/AFTER labels, neutral framing | For improvement showcases |
| pros-cons | 👎/👍 with accent left borders | For balanced evaluation |

**Fields:**
- `title` (text, required)
- `columns` (columns — reuses existing `[ContentBlock, ContentBlock]`, each with title + items[])

**No new SlideContent fields** — reuses `columns[]`. Variant determines visual treatment (red/green, labels, icons).

**AI trigger:** Source explicitly compares good vs bad, before vs after, pros vs cons.

### 2.5 title-cards

**Purpose:** Banner image + 2-4 photo cards below. User provides title and images, auto-layout handles the rest.

**Variants:**
| Variant | Layout | When |
|---------|--------|------|
| banner-2 | Banner + 2 large cards | 2 sub-topics |
| banner-3 | Banner + 3 cards | 3 sub-topics |
| banner-4 | Banner + 4 small cards | 4 sub-topics |

**Fields:**
- `title` (text, required)
- `bannerImage` (image — single banner image with fit selector)
- `cards` (cards with image support — each card has title, body?, imageUrl?)

**New SlideContent fields:**
```ts
bannerImage?: { url: string; fit?: 'cover' | 'contain' };
// cards[] already exists, but cards in title-cards will use imageUrl field:
// cards?: { title: string; body?: string; icon?: string; imageUrl?: string }[];
```

**AI trigger:** Source has multiple sub-topics, each with a representative image.

### SlideContent Changes Summary

```ts
// New fields added to SlideContent
images?: { url: string; caption?: string; fit?: 'cover' | 'contain' }[];
bannerImage?: { url: string; fit?: 'cover' | 'contain' };
highlightLines?: number[];

// Extended card type (add optional imageUrl)
cards?: { title: string; body?: string; icon?: string; imageUrl?: string }[];

// SlideType union expanded
export type SlideType =
  | "cover" | "section-divider" | "content" | "two-column"
  | "dataviz" | "quote" | "story-cards" | "closing"
  | "image-showcase" | "icon-grid" | "statement" | "comparison" | "title-cards";
```

---

## 3. AI Decision Tree Prompt

Replace the current flat slide-types table with a sequential decision tree. The tree is auto-generated from `buildPromptTable()` using each plugin's `promptDescription`.

```
## Slide Type Selection (evaluate in order, stop at first match)

1. First slide? → cover
2. Last slide? → closing
3. Section break? → section-divider
4. Source contains concrete numbers/statistics? → dataviz
5. Source contains a direct quote/citation? → quote
6. Source has one core claim, NO list? → statement
7. Source explicitly compares good/bad, before/after? → comparison
8. Source needs to show screenshots/UI/diagrams? → image-showcase
9. Source has multiple sub-topics each with a representative image? → title-cards
10. Source has 3-6 features/steps, each one sentence? → icon-grid
11. Source has 2-3 parallel concepts needing longer descriptions? → story-cards
12. Source puts two concepts side by side (not good/bad)? → two-column
13. Default → content

## Variant Selection
- Variant is determined by item count (e.g., 3 cards → grid-3, 4 cards → grid-4)
- Choose the variant that best fits the number of content items
```

---

## 4. Per-Slide Speaker Notes & Image Prompt Generation

### UI

Two buttons at the bottom of each slide's editor area:

```
┌─────────────────────────────────┐
│ [slide editing fields...]       │
│                                 │
│ ┌──────────┐  ┌──────────┐     │
│ │ 📝 生成講稿 │  │ 🖼️ 生成圖片 │     │
│ └──────────┘  └──────────┘     │
│                                 │
│ (after generation: editable     │
│  preview, button becomes        │
│  "重新生成")                     │
└─────────────────────────────────┘
```

- Buttons trigger per-slide, not batch
- Results display below buttons, editable by user
- Already-generated content shows preview, button label changes to "重新生成"

### API: Refine Route Extension

New action types added to the existing refine route:

```ts
// Request
{
  action: 'generate-notes' | 'generate-image-prompt',
  slideId: string,
  slideContent: SlideContent,
  presentationTitle: string
}

// Response (SSE)
event: result
data: { slideId: string, speakerNotes?: string, imagePrompt?: string }
```

### Speaker Notes Prompt

```
You are a presentation speaking coach. Write what the presenter should SAY
while this slide is on screen.

Rules:
- NEVER repeat text that's already on the slide
- Write supplementary explanations, background stories, extended details
- Include transition phrases ("Next, let's look at...")
- Include audience interaction cues ("Has anyone experienced...")
- Natural, conversational tone — like talking to people
- Length: 3-5 sentences
- Language: match the slide content language
```

### Image Prompt

```
Based on this slide's topic, generate an English image description suitable
for a background image.

Style: professional, modern, clean. No text elements.
Abstract or contextual imagery that supports the slide's message.
```

---

## 5. Migration Plan

### Files to Refactor (existing → plugin)
1. `slide-templates.ts` → split into 8 template folders + registry + helpers
2. `slide-engine-css.ts` → extract template CSS to each folder's styles.ts, keep base/personality/animation CSS
3. `slide-layout-editor.tsx` → replace ContentEditor internals with FieldRenderer
4. `presentations-store.ts` → expand SlideType union + add new SlideContent fields

### Files to Create (new templates)
5. 5 new template folders (image-showcase, icon-grid, statement, comparison, title-cards)
6. FieldRenderer component (generic field rendering)

### Files to Modify
7. `generate/route.ts` → replace hardcoded prompt table with `buildPromptTable()`
8. `refine/route.ts` → add generate-notes and generate-image-prompt actions
9. `slide-layout-editor.tsx` → add per-slide generation buttons UI

### Order
- Phase 1: Plugin architecture + migrate 8 existing templates (no behavior change)
- Phase 2: Add 5 new templates
- Phase 3: Per-slide generation (notes + image prompt)
