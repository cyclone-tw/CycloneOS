# Slide Engine V3 Refactor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the slide engine to use a fixed 1280×720 canvas with transform:scale() for consistent rendering across all screen sizes, fix CSS class collisions, improve content distribution, add Chinese font support, and upgrade bullet styling.

**Architecture:** Fixed canvas (1280×720) inside a viewport wrapper. JS computes scale factor on resize. All slide-internal CSS selectors scoped with parent selectors to prevent class collisions. Navigation UI lives outside the scaled canvas at viewport level.

**Tech Stack:** TypeScript, CSS-in-JS (template strings), Next.js dashboard

**Spec:** `docs/superpowers/specs/2026-03-27-slide-engine-v3-design.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `dashboard/src/lib/slide-engine-css.ts` | **Rewrite** | Fixed canvas CSS, scoped selectors, vertical distribution, card bullets, V3 font sizes |
| `dashboard/src/lib/slide-engine-nav.ts` | **Rewrite** | rescale() with resize listener, viewport-level nav positioning |
| `dashboard/src/lib/presentations-utils.ts` | **Modify** | Add `.viewport` wrapper, move nav outside `.slide-deck` |
| `dashboard/src/lib/presentation-themes.ts` | **Modify** | Add Chinese font fallback + Google Fonts URLs for all 24 themes |
| `dashboard/src/lib/slide-templates.ts` | **No change** | Templates emit variant names on `.slide` element, but CSS fix is on the selector side — all layout selectors are now scoped to inner containers, so variant class on `.slide` has no unwanted effect |
| `dashboard/src/components/skills/workstations/presentations/slide-preview.tsx` | **No change** | iframe srcDoc works unchanged. V3 rescale() uses the iframe's `window.innerWidth/Height` which correctly reflects the iframe dimensions. Body background uses theme bg (not black) to avoid double-letterboxing in the 16:9 iframe container |

---

### Task 1: Rewrite `slide-engine-css.ts` — Fixed Canvas + Scoped Selectors + Card Bullets

**Files:**
- Rewrite: `dashboard/src/lib/slide-engine-css.ts`

This is the biggest change. The entire `buildCSS()` function is rewritten with:
- Fixed 1280×720 canvas layout (`.viewport` → `.slide-deck` → `.slide`)
- All internal layout selectors scoped (e.g. `.slide-inner .stats-row` not `.stats-row`)
- V3 font sizes (smaller for 1280×720 canvas)
- Vertical content distribution (title top, content flex:1 centered)
- Card-style bullets with left accent border

- [ ] **Step 1: Rewrite `buildCSS()` — Reset, Viewport & Slide Container**

Replace the reset, body, slide-deck, slide, and slide-inner sections with V3 fixed canvas layout:

```typescript
// Key changes:
// - html,body: overflow hidden, background uses theme bg (not hardcoded #000)
//   This avoids double-letterboxing when rendered inside the dashboard iframe preview,
//   since the iframe is already constrained to 16:9 by the parent component.
// - .viewport: 100vw × 100vh, relative, overflow hidden
// - .slide-deck: 1280px × 720px, absolute, centered with left:50% top:50%, transform-origin center
// - .slide: 1280px × 720px, absolute top:0 left:0, display:none, overflow:hidden
// - .slide.active: display:flex
// - .slide-inner: 48px 64px padding, flex column, justify-content:center, gap:24px
```

**Card background for light themes:** The `cardBg` fallback must use a visible color on light backgrounds. Change the fallback in `buildCSS()`:
```typescript
// Before:
const cardBg = c.cardBg ?? (theme.isDark ? "rgba(30,41,59,0.85)" : "rgba(255,255,255,0.9)");
// After:
const cardBg = c.cardBg ?? (theme.isDark ? "rgba(30,41,59,0.85)" : "rgba(0,0,0,0.04)");
```
This ensures card-style bullets are visible on white backgrounds (subtle gray tint).

- [ ] **Step 2: Rewrite Typography section — V3 sizes**

```
h1: 72px → 56px
h2: 44px → 36px, margin-bottom 32px → 24px
h3: 28px → 24px
p,li: 20px → 18px
.subtitle: 28px → 22px
.badge: 14px → 12px
.body-text: 20px → 18px
.footnote: 16px → 13px
```

- [ ] **Step 3: Rewrite Cover & Section Divider — V3 padding**

```
.cover .slide-inner: padding 80px → 64px
.cover h1: 72px → 56px
.section-divider .slide-inner: padding 80px 100px → 64px 80px
.section-divider .section-title: 56px → 44px
```

- [ ] **Step 4: Rewrite Content section — Card-style bullets**

Replace flat border-bottom list items with card-style bullets:

```css
.content .slide-inner { justify-content: flex-start; padding-top: 56px; }
.content-list { list-style: none; padding: 0; flex: 1; display: flex; flex-direction: column; justify-content: center; }
.content-list li {
  padding: 14px 20px;
  margin-bottom: 8px;
  border-left: 3px solid var(--slide-accent);
  background: var(--slide-card-bg);
  border-radius: 6px;
  font-size: 18px;
  line-height: 1.5;
}
```

- [ ] **Step 5: Rewrite Two-Column — scoped `.columns` selector**

```css
.two-column-inner { justify-content: flex-start; padding-top: 56px; }
.two-column-inner > .columns { display: grid; grid-template-columns: 1fr 1fr; gap: 48px; flex: 1; align-items: start; }
```
(Note: `.columns` selector scoped to `.two-column-inner >`)

- [ ] **Step 6: Rewrite Dataviz — scoped inner selectors + V3 sizes**

All dataviz inner selectors scoped:
```css
.dataviz-inner { justify-content: flex-start; padding-top: 56px; }
.dataviz-inner > .stats-row { ... }       /* was: .slide-inner .stats-row */
.dataviz-inner > .big-number { ... }       /* was: .slide-inner .big-number */
.dataviz-inner > .comparison-grid { ... }  /* was: .comparison-grid */

.stat-value: 80px → 64px
.big-value: 120px → 88px
```

- [ ] **Step 7: Rewrite Quote — V3 sizes**

```css
.quote-text: 32px → 28px
.quote.fullscreen .quote-text: 40px → 34px
.quote.card-overlay .quote-text: 28px → 24px
.quote-inner padding: 80px 120px → 64px 80px
```

- [ ] **Step 8: Rewrite Story Cards — scoped `.cards-grid` selector**

```css
.story-cards-inner { justify-content: flex-start; padding-top: 56px; }
.story-cards-inner > .cards-grid { ... }  /* scoped */
.card-title: 22px → 20px
.card-body: 20px → 18px
```

- [ ] **Step 9: Rewrite Closing — V3 sizes**

```css
.closing .slide-inner padding: 80px → 64px
.closing h1: 72px → 56px
.cta-text: 24px → 20px
```

- [ ] **Step 10: Rewrite Navigation UI — viewport-level positioning**

Navigation stays at viewport level (not inside scaled canvas). Add `pointer-events` and `z-index` to ensure clickability above the scaled deck:

```css
.nav-bar { position: fixed; bottom: 0; left: 0; right: 0; height: 40px; z-index: 100; }
.nav-title { position: fixed; top: 12px; left: 20px; font-size: 12px; z-index: 100; }
.progress-bar { position: fixed; bottom: 0; left: 0; height: 3px; z-index: 101; }
```

- [ ] **Step 11: Grep-verify no unscoped selectors remain**

Search the output of the complete `buildCSS()` rewrite for bare selectors that should be scoped. The following must NOT appear as standalone selectors (only as children of parent selectors):
```bash
# In the final slide-engine-css.ts, ensure these only appear scoped:
grep -n '^\.' dashboard/src/lib/slide-engine-css.ts | grep -E '\.(stats-row|big-number|comparison-grid|cards-grid|columns)\b'
# Every match should be preceded by a parent selector like .dataviz-inner >, .story-cards-inner >, .two-column-inner >
```

- [ ] **Step 12: Commit**

```bash
git add dashboard/src/lib/slide-engine-css.ts
git commit -m "feat(slide-engine): V3 CSS — fixed canvas 1280×720, scoped selectors, card bullets"
```

---

### Task 2: Rewrite `slide-engine-nav.ts` — rescale() + Resize Listener

**Files:**
- Rewrite: `dashboard/src/lib/slide-engine-nav.ts`

- [ ] **Step 1: Add rescale function and resize listener**

Add to the top of the IIFE:
```javascript
const SLIDE_W = 1280, SLIDE_H = 720;
const deck = document.querySelector('.slide-deck');

function rescale() {
  const vw = window.innerWidth, vh = window.innerHeight;
  const scale = Math.min(vw / SLIDE_W, vh / SLIDE_H);
  deck.style.transform = 'translate(-50%, -50%) scale(' + scale + ')';
}

window.addEventListener('resize', rescale);
rescale();
```

- [ ] **Step 2: Keep existing slide navigation logic unchanged**

The showSlide/nextSlide/prevSlide/keyboard/message handlers remain the same. Only add rescale at top.

- [ ] **Step 3: Commit**

```bash
git add dashboard/src/lib/slide-engine-nav.ts
git commit -m "feat(slide-engine): V3 nav — add rescale() for fixed canvas scaling"
```

---

### Task 3: Modify `presentations-utils.ts` — Viewport Wrapper

**Files:**
- Modify: `dashboard/src/lib/presentations-utils.ts`

- [ ] **Step 1: Add `.viewport` wrapper around slide-deck in HTML output**

Change `outlineToHtml()` HTML structure:
```html
<!-- Before -->
<body>
  <div class="slide-deck">...</div>
  <!-- nav -->

<!-- After -->
<body>
  <div class="viewport">
    <div class="slide-deck">...</div>
  </div>
  <!-- nav stays outside viewport, at body level -->
```

Nav elements (`.nav-title`, `.nav-bar`, `#progress-bar`) stay at body level — they use `position: fixed` and shouldn't be inside the scaled canvas.

- [ ] **Step 2: Commit**

```bash
git add dashboard/src/lib/presentations-utils.ts
git commit -m "feat(slide-engine): V3 HTML structure — add viewport wrapper"
```

---

### Task 4: Modify `presentation-themes.ts` — Chinese Font Fallbacks

**Files:**
- Modify: `dashboard/src/lib/presentation-themes.ts`

Strategy per category:
- **consulting** (mckinsey, bcg, deloitte, accenture): add `Noto Sans TC` fallback to heading & body
- **startup** (yc-minimal, sequoia, dark-tech): add `Noto Sans TC` fallback
- **modern** (glass, bento, neobrutal, editorial): add `Noto Sans TC` fallback (editorial uses `Noto Serif TC`)
- **minimal** (swiss, soft, mono-bold): add `Noto Sans TC` fallback
- **data** (dashboard, infographic): add `Noto Sans TC` fallback
- **education** (academic, classroom): classroom heading `Huninn`, body `Noto Sans TC`; academic heading `Noto Serif TC`, body `Noto Sans TC`
- **asian** (takahashi, zen): already have Noto Sans/Serif TC — no change
- **institutional** (gov-official, institutional): gov-official already has Noto Sans TC; institutional add `Noto Sans TC`
- **creative** (aurora, noir): add `Noto Sans TC` fallback

- [ ] **Step 1: Update consulting themes (mckinsey, bcg, accenture) — add font fallbacks + Google Fonts URLs**

For themes without `googleFontsUrl`, add one. For all, append Chinese font to font-family:

```typescript
// mckinsey:
heading: "'Georgia', 'Noto Serif TC', serif"
body: "'Arial', 'Noto Sans TC', sans-serif"
googleFontsUrl: "https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;500;700&family=Noto+Serif+TC:wght@400;600;700&display=swap"

// bcg:
heading: "'Trebuchet MS', 'Noto Sans TC', sans-serif"
body: "'Trebuchet MS', 'Noto Sans TC', sans-serif"
googleFontsUrl: "https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;500;700&display=swap"

// accenture:
heading: "'Arial', 'Noto Sans TC', sans-serif"
body: "'Arial', 'Noto Sans TC', sans-serif"
googleFontsUrl: "https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;500;700&display=swap"
```

- [ ] **Step 2: Update deloitte — append Chinese fonts to existing Google Fonts URL**

```typescript
heading: "'Montserrat', 'Noto Sans TC', sans-serif"
body: "'Open Sans', 'Noto Sans TC', sans-serif"
googleFontsUrl: "...existing...&family=Noto+Sans+TC:wght@400;500;700&display=swap"
```

- [ ] **Step 3: Update startup themes (yc-minimal, sequoia, dark-tech)**

```typescript
// yc-minimal:
heading: "'Inter', 'Noto Sans TC', sans-serif"
body: "'Inter', 'Noto Sans TC', sans-serif"
googleFontsUrl: "...existing...&family=Noto+Sans+TC:wght@400;500;700"

// sequoia:
heading: "'Helvetica Neue', 'Noto Sans TC', sans-serif"
body: "'Helvetica Neue', 'Noto Sans TC', sans-serif"
googleFontsUrl: "https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;500;700&display=swap"

// dark-tech:
heading: "'Space Grotesk', 'Noto Sans TC', sans-serif"
body: "'Inter', 'Noto Sans TC', sans-serif"
googleFontsUrl: "...existing...&family=Noto+Sans+TC:wght@400;500;700"
```

- [ ] **Step 4: Update modern themes (glass, bento, neobrutal, editorial)**

```typescript
// glass, bento, neobrutal: append 'Noto Sans TC' to heading+body, add to URL
// editorial: heading append 'Noto Serif TC', body append 'Noto Serif TC'
//   googleFontsUrl add: &family=Noto+Serif+TC:wght@400;600;700
```

- [ ] **Step 5: Update minimal themes (swiss, soft, mono-bold)**

```typescript
// swiss: no googleFontsUrl → add one with Noto Sans TC
heading: "'Helvetica Neue', 'Noto Sans TC', sans-serif"
body: "'Helvetica Neue', 'Noto Sans TC', sans-serif"
googleFontsUrl: "https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;500;700&display=swap"

// soft, mono-bold: append to existing URLs
```

- [ ] **Step 6: Update data themes (dashboard, infographic)**

Append `Noto Sans TC` to heading+body, add to existing Google Fonts URLs.

- [ ] **Step 7: Update education themes (academic, classroom)**

```typescript
// academic:
heading: "'Source Serif Pro', 'Noto Serif TC', serif"
body: "'Calibri', 'Noto Sans TC', sans-serif"
googleFontsUrl: "...existing...&family=Noto+Sans+TC:wght@400;500;700&family=Noto+Serif+TC:wght@400;600;700"

// classroom:
heading: "'Huninn', 'Noto Sans TC', sans-serif"
body: "'DM Sans', 'Noto Sans TC', sans-serif"
googleFontsUrl: "...existing...&family=Huninn&family=Noto+Sans+TC:wght@400;500;700"
```

- [ ] **Step 8: Update institutional theme (institutional — gov-official already has Noto Sans TC)**

```typescript
// institutional:
heading: "'Merriweather', 'Noto Sans TC', serif"
body: "'Open Sans', 'Noto Sans TC', sans-serif"
googleFontsUrl: "...existing...&family=Noto+Sans+TC:wght@400;500;700"
```

- [ ] **Step 9: Update creative themes (aurora, noir)**

```typescript
// aurora:
heading: "'Outfit', 'Noto Sans TC', sans-serif"
body: "'Sora', 'Noto Sans TC', sans-serif"
googleFontsUrl: "...existing...&family=Noto+Sans+TC:wght@400;500;700"

// noir:
heading: "'Cormorant Garamond', 'Noto Serif TC', serif"
body: "'Montserrat', 'Noto Sans TC', sans-serif"
googleFontsUrl: "...existing...&family=Noto+Sans+TC:wght@400;500;700&family=Noto+Serif+TC:wght@400;600;700"
```

- [ ] **Step 10: Commit**

```bash
git add dashboard/src/lib/presentation-themes.ts
git commit -m "feat(themes): add Chinese font fallbacks (Noto Sans/Serif TC, Huninn) to all 24 themes"
```

---

### Task 5: Build Verification

**Files:** None (verification only)

- [ ] **Step 1: Run TypeScript type check**

```bash
cd dashboard && npx tsc --noEmit 2>&1 | head -30
```
Expected: No errors

- [ ] **Step 2: Run Next.js build**

```bash
cd dashboard && npm run build 2>&1 | tail -20
```
Expected: Build succeeds

- [ ] **Step 3: Fix any type errors or build issues**

If errors found, fix them and re-run.

---

### Task 6: Visual Verification via Browser

**Files:** None (manual verification)

- [ ] **Step 1: Start dev server**

```bash
cd dashboard && npm run dev
```

- [ ] **Step 2: Generate a test presentation**

Navigate to the presentations workstation, select a theme, and generate a 6-8 slide presentation.

- [ ] **Step 3: Verify acceptance criteria**

1. Slides scale proportionally when resizing browser window (no distortion)
2. Letterboxing appears when aspect ratio doesn't match 16:9
3. Content is vertically centered (no large empty bottom areas)
4. Card-style bullets have left accent border + rounded background
5. Chinese text renders with correct fonts (not fallback system fonts)
6. Navigation UI (arrows, progress bar, page counter) stays at viewport level, doesn't scale
7. stats-row/big-number slides don't break other slide visibility
8. Export HTML works and the exported file scales correctly when opened directly
9. **In dashboard iframe preview:** nav arrows, progress bar, and page counter work correctly inside the iframe (position:fixed relative to iframe viewport)
10. Card-style bullets are visible on both light themes (subtle gray bg) and dark themes

- [ ] **Step 4: Test 3+ themes to confirm visual differentiation**

Switch between mckinsey, dark-tech, zen to confirm each has distinct colors, fonts, and feel.

---

## Parallelization Guide

Tasks 1, 2, 3, and 4 are fully independent and can be executed in parallel.
- Task 3 only adds a `.viewport` wrapper — the structure is defined in the spec, no dependency on CSS/nav content.
Task 5 depends on all code tasks (1-4) completing.
Task 6 is manual and depends on Task 5.

**Recommended execution order:**
```
[Task 1] ──┐
[Task 2] ──┤
[Task 3] ──┼── [Task 5] → [Task 6]
[Task 4] ──┘
```
