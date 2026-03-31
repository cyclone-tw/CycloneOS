# Slide Engine V3.2 — Layout Control + Image Split

**Date:** 2026-03-28
**Status:** Approved
**Scope:** 4 features + 2 bug fixes

## Summary

V3.2 adds layout control capabilities to the slide engine: image split layouts (horizontal/vertical/overlay), badge position control (6 positions), per-slide text alignment, and image source UI (URL/upload/AI generation). Also fixes two existing bugs: fragment visibility in browse mode and vertical whitespace distribution.

## Requirements (Confirmed)

| Requirement | Decision |
|-------------|----------|
| Scope | All 4 features in one release |
| Split layout applies to | All 8 slide types |
| Split directions | Horizontal (adjustable ratio) + Vertical + Full-bleed overlay |
| Image sources | URL input + File upload + AI generation |
| Image embedding | Upload/AI → base64 inline, URL → external link |
| Badge positions | 6 positions (top-left/center/right, bottom-left/center/right) |
| Text alignment | Per-slide (left/center/right) |

## 1. Data Model Changes

File: `presentations-store.ts`

### New Types

```typescript
export type BadgePosition =
  "top-left" | "top-center" | "top-right" |
  "bottom-left" | "bottom-center" | "bottom-right";

export type TextAlign = "left" | "center" | "right";

export type SplitMode = "default" | "split-horizontal" | "split-vertical" | "image-overlay";

export interface SlideImage {
  url?: string;        // External image URL
  base64?: string;     // Inline base64 (upload/AI generated)
  prompt?: string;     // AI generation prompt
  overlay?: "dark" | "light" | "gradient";  // For overlay mode
  fit?: "cover" | "contain";  // Image fit, default "cover"
}

export interface SlideLayout {
  mode: SplitMode;                                           // Default "default"
  imagePosition?: "left" | "right" | "top" | "bottom";      // Image placement
  splitRatio?: number;                                        // Image percentage 30-70, default 50
  image?: SlideImage;
}
```

### SlideContent Extensions

```typescript
export interface SlideContent {
  // ...all existing fields unchanged...
  layout?: SlideLayout;           // Split layout settings
  badgePosition?: BadgePosition;  // Badge position, default "top-center"
  textAlign?: TextAlign;          // Per-slide text alignment, default "center"
}
```

### Store Actions (New)

```typescript
// Layout
setSlideLayout: (slideId: string, layout: Partial<SlideLayout>) => void
setSlideImage: (slideId: string, image: SlideImage) => void
removeSlideImage: (slideId: string) => void

// Badge & Text
setBadgePosition: (slideId: string, position: BadgePosition) => void
setTextAlign: (slideId: string, align: TextAlign) => void
```

### Design Notes

- All new fields are optional — zero impact on existing slides
- `SlideImage` is separate from existing `BackgroundImage` — one is for split panel, the other is full-screen background
- `splitRatio` is the image's percentage (30 = image 30% + content 70%)

## 2. HTML Rendering Strategy

File: `slide-templates.ts`

### Approach: Layout Modifier + Dedicated Image Panel (A+C hybrid)

Template functions remain unchanged. A new `wrapWithLayout()` function wraps the template output based on `layout.mode`:

```
slideToHtml(slide, index, total, animation?)
  ├─ Step 1: Template function outputs slide HTML (unchanged)
  └─ Step 2: wrapWithLayout() checks slide.content.layout.mode
       │
       ├─ "default" (or no layout) → No wrapping, return as-is
       │
       ├─ "split-horizontal" → CSS Grid left/right split
       │    <div class="split-layout horizontal"
       │         style="grid-template-columns: {contentRatio}fr {imageRatio}fr">
       │      <div class="content-panel">{original template output}</div>
       │      <div class="image-panel"><img .../></div>
       │    </div>
       │
       ├─ "split-vertical" → CSS Grid top/bottom split
       │    <div class="split-layout vertical"
       │         style="grid-template-rows: {imageRatio}fr {contentRatio}fr">
       │      <div class="image-panel">...</div>
       │      <div class="content-panel">{original template output}</div>
       │    </div>
       │
       └─ "image-overlay" → Image as background, content on top
            <div class="overlay-layout" style="background-image: url(...)">
              <div class="overlay-mask {dark|light|gradient}"></div>
              <div class="content-panel">{original template output}</div>
            </div>
```

### Key Decisions

- **Template functions untouched** — they continue outputting their original HTML
- **Wrapping happens last** — single `wrapWithLayout()` handles all layout modes
- **`imagePosition`** controls image side — via CSS `order` property swap
- **Image source priority**: `base64` > `url` (if base64 exists, use it)
- **Badge position** — change from inline rendering to `position: absolute` + position class
- **Text align** — `data-text-align` attribute on slide element, CSS handles the rest

## 3. CSS Changes

File: `slide-engine-css.ts`

### Split Layout CSS

```css
/* Split layout container */
.split-layout {
  display: grid;
  width: 100%;
  height: 100%;
}

.split-layout.horizontal {
  /* grid-template-columns set inline via splitRatio */
}

.split-layout.vertical {
  /* grid-template-rows set inline via splitRatio */
}

/* Image panel */
.image-panel {
  overflow: hidden;
  position: relative;
}

.image-panel img {
  width: 100%;
  height: 100%;
  object-fit: cover;  /* or contain via data attribute */
}

/* Content panel — preserves original template layout */
.content-panel {
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: var(--slide-padding);
  overflow: hidden;
}

/* Image position swap via order */
.split-layout[data-img-pos="left"] .image-panel,
.split-layout[data-img-pos="top"] .image-panel { order: -1; }

/* Overlay layout */
.overlay-layout {
  position: relative;
  width: 100%;
  height: 100%;
  background-size: cover;
  background-position: center;
}

.overlay-mask {
  position: absolute;
  inset: 0;
}

.overlay-mask.dark { background: rgba(0,0,0,0.55); }
.overlay-mask.light { background: rgba(255,255,255,0.4); }
.overlay-mask.gradient { background: linear-gradient(to top, rgba(0,0,0,0.8), transparent); }

.overlay-layout .content-panel {
  position: relative;
  z-index: 1;
}
```

### Badge Position CSS

```css
/* Badge becomes absolutely positioned */
.slide .badge {
  position: absolute;
  z-index: 2;
}

/* 6 positions */
.badge.badge-top-left     { top: var(--slide-padding); left: var(--slide-padding); }
.badge.badge-top-center   { top: var(--slide-padding); left: 50%; transform: translateX(-50%); }
.badge.badge-top-right    { top: var(--slide-padding); right: var(--slide-padding); }
.badge.badge-bottom-left  { bottom: var(--slide-padding); left: var(--slide-padding); }
.badge.badge-bottom-center{ bottom: var(--slide-padding); left: 50%; transform: translateX(-50%); }
.badge.badge-bottom-right { bottom: var(--slide-padding); right: var(--slide-padding); }
```

### Text Alignment CSS

```css
.slide[data-text-align="left"]  .slide-inner { text-align: left; align-items: flex-start; }
.slide[data-text-align="right"] .slide-inner { text-align: right; align-items: flex-end; }
/* center is default — no override needed */
```

## 4. UI Controls

File: `style-settings-panel.tsx`

### New Controls (shown when a slide is selected)

#### Layout Mode Selector
- 4-button toggle: 預設 | 左右分割 | 上下分割 | 圖片覆蓋
- Only show image settings when mode != "default"

#### Image Settings Panel (conditional — shown when split/overlay mode)
- **3 tabs**: URL | 上傳 | AI 生成
  - URL tab: text input + preview
  - Upload tab: file input (accept image/*) → convert to base64
  - AI tab: prompt textarea + generate button (uses existing Claude session)
- **Split ratio slider**: 30-70%, step 5, default 50
- **Image position**: 2-button toggle (left/right for horizontal, top/bottom for vertical)
- **Image fit**: Cover | Contain toggle
- **Overlay type**: (only for overlay mode) Dark | Light | Gradient

#### Badge Position Selector
- 6-button grid (2 rows x 3 columns) matching the 6 positions
- Visual: small squares showing position on a mini slide wireframe

#### Text Alignment
- 3-button toggle: Left | Center | Right
- Icons: standard alignment icons

## 5. Bug Fixes (Included in V3.2)

### Fix: Fragment visibility in browse mode

**Problem:** In browse mode, `<li>` items with `.fragment` class have `opacity: 0`, making content invisible. Users see column headers but empty content below.

**Fix:** In browse mode CSS, ensure `.fragment { opacity: 1; }` by default. Only hide fragments in present mode before they are revealed.

```css
/* Browse mode — all fragments visible */
.slide .fragment { opacity: 1; transform: none; }

/* Present mode — fragments hidden until revealed */
body.present-mode .slide .fragment { opacity: 0; }
body.present-mode .slide .fragment.visible { opacity: 1; }
```

### Fix: Vertical whitespace distribution

**Problem:** Content (stats cards, two-column content) clusters at top of slide, leaving large empty space at bottom.

**Fix:** Ensure `.slide-inner` uses `justify-content: center` consistently across all slide types. For slides with sparse content, the flex layout should vertically center the content block.

Review each slide type's inner container and ensure vertical centering is applied. Some types (like dataviz) may have `justify-content: flex-start` that should be changed to `center`.

## 6. Image Embedding Strategy

| Source | Storage | In exported HTML |
|--------|---------|-----------------|
| URL input | `SlideImage.url` | `<img src="https://...">` (external) |
| File upload | `SlideImage.base64` | `<img src="data:image/...;base64,...">` (inline) |
| AI generated | `SlideImage.base64` | `<img src="data:image/...;base64,...">` (inline) |

- Upload handler converts file to base64 via `FileReader.readAsDataURL()`
- AI generation returns base64 from API, stored directly
- File size consideration: each 1MB image ≈ 1.37MB in base64. A presentation with 5-6 images may reach 8-10MB HTML — acceptable for local use and sharing.

## 7. Files to Modify

| File | Changes |
|------|---------|
| `presentations-store.ts` | New types, SlideContent fields, 5 new store actions |
| `slide-templates.ts` | `wrapWithLayout()`, badge position rendering, `data-text-align` attribute |
| `slide-engine-css.ts` | Split layout CSS, badge position CSS, text align CSS, fragment fix, vertical centering fix |
| `style-settings-panel.tsx` | Layout mode selector, image settings panel, badge position grid, text align toggle |
| `presentations-utils.ts` | Pass layout data through HTML generation pipeline |

No new files needed — all changes extend existing files.

## 8. Out of Scope

- Drag-and-drop image reposition within the panel
- Multiple images per slide
- Image cropping/editing
- Video embedding
- Per-block text alignment (title vs body separately)
