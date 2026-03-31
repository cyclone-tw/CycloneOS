# Slide Engine V2 — Design Spec

> Replaces reveal.js-based renderer with a custom lightweight slide engine featuring slide-type templates, fragment animation, and CSS-variable theming.

## Context

Session #07 built the Presentations Workstation (Phase P0-P2) using reveal.js as the rendering engine. Three bugs were discovered:

1. **Font overlapping** — `outlineToRevealHtml()` uses absolute positioning with percentage coordinates; blocks overlap.
2. **Theme not applying** — reveal.js CDN theme CSS overrides custom CSS variables; load order conflicts.
3. **State transition issues** — theme picker → generate flow has confusing status transitions.

After researching three external references (S08 HTML slides, UI/UX Pro Max skill, AAAAAAAJ/slides), the decision is to **replace reveal.js entirely** with a custom slide engine inspired by the S08 approach.

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Rendering engine | Custom HTML/CSS/JS (no reveal.js) | Full control over layout, themes, and animations; smaller output (~20KB vs 500KB+ CDN) |
| Layout strategy | Slide Type templates with flexbox/grid | Eliminates coordinate-based positioning; zero overlap risk |
| Content generation | Claude selects slideType + variant, fills structured content | Claude handles narrative decisions; CSS templates handle layout |
| Theme system | CSS custom properties embedded in HTML | No CDN conflicts; theme switch = regenerate HTML |
| Fragment animation | CSS transitions triggered by keyboard navigation | Right arrow reveals blocks one by one, like S08 |
| Background images | Data model pre-reserved; CSS hooks ready | Future AI image generation can plug in without template changes |

## Slide Type System

8 types, 22 variants:

| slideType | Variants | Purpose |
|-----------|----------|---------|
| `cover` | `image-bg`, `gradient`, `clean` | Title slide with background |
| `section-divider` | `dark`, `accent` | Chapter separator |
| `content` | `bullets`, `numbered`, `paragraph` | General content with title + body |
| `two-column` | `text-text`, `text-image`, `text-list` | Side-by-side comparison |
| `dataviz` | `horizontal-bars`, `big-number`, `stats-row`, `comparison` | Data visualization |
| `quote` | `fullscreen`, `card-overlay`, `simple` | Quotation / testimonial |
| `story-cards` | `grid-3`, `grid-2`, `single` | Case study cards |
| `closing` | `cta`, `summary`, `thank-you` | End slide |

Unknown type/variant → fallback to `content/bullets`.

## Data Model

### SlideContent (replaces SlideBlock + coordinates)

```typescript
export type SlideType =
  | "cover" | "section-divider" | "content" | "two-column"
  | "dataviz" | "quote" | "story-cards" | "closing";

export interface SlideContent {
  slideType: SlideType;
  variant: string;
  title?: string;
  subtitle?: string;
  body?: string;
  badge?: string;              // cover: top badge text (e.g., "ANTHROPIC 2026")
  items?: ContentItem[];
  columns?: [ContentBlock, ContentBlock];  // two-column AND dataviz/comparison
  quote?: { text: string; author?: string; source?: string };
  cards?: { title: string; body: string; icon?: string }[];
  bigNumber?: { value: string; label: string };
  stats?: { value: string; label: string }[];
  footnote?: string;           // Also used as "source" in closing slides
  backgroundImage?: BackgroundImage;
}

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
  prompt?: string;           // For future AI generation
  overlay?: "dark" | "light" | "gradient";
  position?: "cover" | "contain" | "left" | "right";
}
```

### SlideDefinition (modified)

```typescript
export interface SlideDefinition {
  id: string;
  order: number;
  content: SlideContent;     // Replaces: layout + blocks[]
}
```

### SlideOutline (unchanged structure)

```typescript
export interface SlideOutline {
  title: string;
  theme?: string;
  slides: SlideDefinition[];
}
```

### Removed types
- `SlideBlock` (x/y/width/height coordinate system) — deleted entirely
- `SlideLayout` ("title" | "content" | "two-column" | "image-full" | "blank") — replaced by `SlideType`

### Content field retention policy

When the user changes `slideType` or `variant` via the Layout Picker, **all content fields persist in the data model**. Only the template-rendered fields change. Fields irrelevant to the current slideType are simply ignored by the template. The editor UI shows only fields relevant to the current slideType.

### Dataviz value parsing convention

`ContentItem.value` is always a string (e.g., `"18.8%"`, `"$1.2M"`, `"42"`). Templates extract the leading numeric portion via `parseFloat()` for proportional rendering (e.g., bar widths scale relative to the max value in the set). The raw string is displayed as the label.

### Dataviz `comparison` variant

The `comparison` variant reuses `columns: [ContentBlock, ContentBlock]`. Each column has a `title` (e.g., "好處" / "恐懼") and `items` with label + value pairs. The template renders them as side-by-side cards with contrasting accent/negative colors.

### Store Actions (modified)

Actions that change signature or are removed:

```typescript
// REMOVED
updateBlock: (slideId, blockId, updates) => void;  // No more blocks
setBlockImage: (slideId, blockId, src) => void;     // No more blocks

// MODIFIED
addSlide: (slideType: SlideType, afterSlideId?: string) => void;
  // Was: addSlide(layout: SlideLayout, ...)
  // Creates a slide with default content for the given slideType

// NEW
setSlideLayout: (slideId: string, slideType: SlideType, variant: string) => void;
  // Changes slideType + variant, preserves all content fields

updateSlideContent: (slideId: string, updates: Partial<SlideContent>) => void;
  // Replaces updateBlock; updates any content fields

// UNCHANGED (signature preserved)
setOutline, reorderSlides, deleteSlide, setSelectedSlide
```

### RendererType

Rename `"revealjs"` to `"html"` in `RendererType`. Default for new sessions is `"html"`. Canva and Felo renderers remain unchanged. `RendererState` for html: `{ type: "html"; html?: string }`.

## HTML Generation Engine

### Architecture

```
outlineToHtml(outline, theme)
  ├── buildCSS(theme)           // CSS variables + all template styles + animation
  ├── buildGoogleFontsLink()    // <link> for theme fonts
  ├── slides.map(slideToHtml)   // Each slide → template function based on slideType
  ├── buildNavJS()              // Keyboard nav + fragment logic (~70 lines)
  └── assemble into single HTML
```

### Template function signature

```typescript
function slideToHtml(slide: SlideContent, index: number, total: number): string
```

Each template returns a `<div class="slide {slideType} {variant}">` with `.fragment` classes on child elements.

### Output characteristics
- Single self-contained `.html` file
- ~20-30KB (no external JS/CSS dependencies)
- Only external resource: Google Fonts `<link>`
- Background images referenced by URL if present

## Fragment Animation System

### Mechanism

1. All `.fragment` elements start with `opacity: 0; transform: translateY(20px)`
2. Pressing → or Space adds `.visible` class to next fragment
3. CSS transition: `opacity 0.5s ease, transform 0.5s ease`
4. When all fragments on current slide are visible, next → advances to next slide
5. Pressing ← reverses (hides last fragment, or goes to previous slide with all fragments visible)

### Auto-fragment rules per slideType

| slideType | Fragment order |
|-----------|---------------|
| `cover` | `badge` → `title` → `subtitle` → `footnote` |
| `section-divider` | `subtitle` (label) → `title` (or all at once) |
| `content` | `title` → each item in `items`/`body` one by one |
| `two-column` | `title` → `columns[0]` → `columns[1]` → `footnote` |
| `dataviz` | `title` → each item/stat one by one → `footnote` |
| `quote` | `quote` card → `body` (context text) |
| `story-cards` | `title` → each card one by one → `footnote` |
| `closing` | `title` → `body` (CTA text) → `footnote` (source) |

### Edge cases
- Slides with zero `.fragment` children advance immediately on → press
- Rapid key presses are debounced (min 100ms between fragment reveals)
- Touch swipe support: out of scope for V2, future enhancement

### Navigation UI
- Bottom progress bar (accent color, 4px height)
- Page counter (bottom-left, e.g., "3 / 18")
- Arrow buttons (bottom-right, for mouse users)
- Top-left: presentation title (muted)
- Top-right: optional badge

## Theme System

### PresentationTheme interface (modified)

```typescript
export interface PresentationTheme {
  id: string;
  name: string;
  nameZh: string;
  category: ThemeCategory;

  // Replaces: revealTheme, revealColors, revealFonts
  colors: {
    bg: string;
    text: string;
    accent: string;
    secondary?: string;
    muted: string;
    cardBg?: string;
    barColors?: string[];    // For dataviz multi-color bars
  };
  fonts: {
    heading: string;
    body: string;
    mono?: string;
  };

  // New fields
  isDark: boolean;
  googleFontsUrl?: string;

  // Kept for Canva/Felo renderers
  canvaStylePrompt: string;
  feloThemeId?: string;
}
```

### CSS variable mapping

```css
:root {
  --slide-bg: {colors.bg};
  --slide-text: {colors.text};
  --slide-accent: {colors.accent};
  --slide-secondary: {colors.secondary || colors.accent};
  --slide-muted: {colors.muted};
  --slide-card-bg: {colors.cardBg || computed from bg};
  --font-heading: {fonts.heading};
  --font-body: {fonts.body};
  --font-mono: {fonts.mono || 'monospace'};
}
```

Theme switching = call `outlineToHtml()` again with new theme → instant re-render. No CDN load order issues.

### Theme migration from existing 24 themes

Derivation rules for new fields:
- `isDark`: `true` if old `revealTheme` is `"night"` or `"black"`, else `false`
- `muted`: if `isDark`, default `"#94A3B8"`; if light, default `"#64748B"` (both meet contrast requirement)
- `colors.cardBg`: if `isDark`, `"rgba(30,41,59,0.85)"`; if light, `"rgba(255,255,255,0.9)"`
- `colors.barColors`: default `["#3B82F6","#10B981","#A78BFA","#F59E0B","#EF4444","#EC4899","#06B6D4"]`; themes with `secondary` color use it as second bar color
- `googleFontsUrl`: constructed from `fonts.heading` + `fonts.body` + `fonts.mono` (e.g., `"https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;600;700&family=Inter:wght@400;500;600;700&display=swap"`)
- Old `revealTheme`, `revealColors`, `revealFonts` fields are removed; data migrates to `colors`, `fonts`, `isDark`

`buildGoogleFontsLink()` simply returns `theme.googleFontsUrl ?? ""`.

## Sizing & Readability Rules

**CRITICAL**: User has presbyopia. All templates MUST follow these minimums:

| Element | Minimum size | Notes |
|---------|-------------|-------|
| h1 (cover/closing) | 72px | |
| h2 (slide title) | 44px | |
| Body text / labels | 20px | Never smaller |
| Card body text | 20px | |
| Bar chart values | 18px | |
| Stat large numbers | 80px | |
| Muted / footnotes | 16px | Also: color ≥ #94A3B8 contrast |
| Bar height | 52px | |
| Card padding | 36px | |

### Full-viewport coverage

- Every slide MUST fill `100vh` completely — no black gaps at bottom
- Background color/gradient covers the full viewport
- Content distribution uses `justify-content: space-between` or `space-evenly` to avoid clustering at top
- Cover and closing slides use full-viewport gradients

## Layout Picker (UI Component)

### Purpose
After Claude generates the outline, users can change the slideType/variant for any slide.

### Interaction
1. User clicks a slide in the thumbnail list
2. Right panel shows Layout Picker at top:
   - Row of slideType icons (SVG abstract layout diagrams)
   - Claude's suggestion highlighted; compatible types also indicated
   - Selecting a type shows variant radio buttons below
3. Content section below for editing text/items
4. Preview updates instantly when layout changes

### Smart filtering
Based on slide content, indicate which layouts are compatible:
- Has `items` with values → `dataviz` compatible
- Has `quote` → `quote` compatible
- Has `cards` → `story-cards` compatible
- Everything is `content` compatible (universal fallback)

### Store action
```typescript
setSlideLayout: (slideId: string, slideType: SlideType, variant: string) => void;
```

Content fields persist; only `slideType` and `variant` change. Template re-renders with same data.

## Background Image Support (Pre-reserved)

### Data model
`BackgroundImage` interface in `SlideContent` (see Data Model section above).

### CSS hooks
```css
.slide[data-bg] {
  background-size: cover;
  background-position: center;
}
.slide[data-bg].overlay-dark::before {
  content: ''; position: absolute; inset: 0;
  background: rgba(0,0,0,0.55);
  z-index: 0;
}
.slide[data-bg].overlay-gradient::before {
  background: linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 60%);
}
.slide[data-bg] > * { position: relative; z-index: 1; }
```

### HTML rendering
If `backgroundImage.url` is set:
```html
<div class="slide cover overlay-dark" data-bg style="background-image:url('...')">
```

### Future integration point
Add "Set Background" button in Layout Picker → upload image or invoke AI generation → fill `backgroundImage.url` → template auto-applies.

## Claude Prompt (Generate API)

### New prompt structure

Claude receives the slideType table and outputs structured JSON:

```
You are a presentation outline generator.

Available slide types and variants:
[table of 8 types + 22 variants with descriptions]

Output JSON format:
{
  "title": "Presentation Title",
  "slides": [
    {
      "id": "uuid",
      "order": 0,
      "content": {
        "slideType": "cover",
        "variant": "gradient",
        "title": "...",
        "subtitle": "..."
      }
    },
    {
      "id": "uuid",
      "order": 1,
      "content": {
        "slideType": "dataviz",
        "variant": "horizontal-bars",
        "title": "...",
        "items": [{"label": "...", "value": "18.8%"}]
      }
    }
  ]
}

Theme: {theme.name} — {theme.canvaStylePrompt}
If the theme is dark/dramatic, lean into section-dividers and dataviz.
If the theme is minimal, prefer shorter text and more white space.

Rules:
- Choose slideType and variant that best serve the narrative
- Use section-dividers to create rhythm between content sections
- Vary slide types — don't use the same type 3 times in a row
- For dataviz: include actual numbers/percentages when available
- Content language: match user's instruction language
```

### Validation on receive
- All `slide.id` values are regenerated server-side using `crypto.randomUUID()` regardless of Claude output
- Unknown slideType → convert to `content`
- Unknown variant → convert to first variant of that type
- Missing required fields → fill with placeholder text

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `presentations-utils.ts` | **Rewrite** | New `outlineToHtml()` with template functions |
| **New** `slide-templates.ts` | **Create** | 8 template functions + CSS generator + nav JS |
| `presentation-themes.ts` | **Modify** | New interface (remove reveal fields, add new fields) |
| `presentations-store.ts` | **Modify** | New `SlideContent` model, remove `SlideBlock`, add `setSlideLayout` |
| `slide-preview.tsx` | **Small modify** | Remove reveal.js postMessage, simplify srcDoc |
| `slide-block-editor.tsx` | **Rewrite** → `slide-layout-editor.tsx` | Layout Picker + content editor |
| `generate/route.ts` | **Modify** | New prompt outputting slideType + content (no coordinates) |
| `slide-thumbnail-list.tsx` | **Small modify** | Adapt to new data model |
| `outline-editor.tsx` | **Small modify** | Adapt to new data model |

### No new external dependencies
- No reveal.js CDN
- No Chart.js
- Only Google Fonts (already used)

## Migration

Existing sessions in localStorage will have the old `SlideBlock` format. Handle gracefully:
- If `'blocks' in session.outline.slides[0]` (property exists, regardless of value) → treat as legacy
- Legacy sessions show a banner: "此簡報使用舊版引擎，請重新生成以使用新版排版系統"
- New sessions use `SlideContent` format exclusively

### Aspect ratio in new engine

The new HTML renders full-viewport (`100vh × 100vw`). When embedded in the dashboard's preview iframe, the parent container uses `aspect-video` or `aspect-[4/3]` CSS classes to maintain the correct ratio. The HTML fills 100% of the iframe dimensions. No fixed width/height values are set in the HTML itself.
