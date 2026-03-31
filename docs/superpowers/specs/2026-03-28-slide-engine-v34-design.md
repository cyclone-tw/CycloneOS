# Slide Engine V3.4 — Editor Polish + Prompt Tuning

**Date:** 2026-03-28
**Status:** Approved
**Scope:** 6 items (subtitleScale, full field editing, prompt tuning, section divider, content fidelity test, PDF bug fix)
**Deferred to V3.5:** LLM adapter abstraction layer, AI task logging + dashboard widget

---

## 1. subtitleScale Slider

**Goal:** Add subtitle font size control, matching existing titleScale pattern.

**Changes:**

- **`presentations-store.ts`** — Add `subtitleScale: number` to `CustomParams` interface; add `subtitleScale: 1.0` to `DEFAULT_CUSTOM_PARAMS`
- **`style-settings-panel.tsx`** — Add ParamSlider for subtitleScale (range 0.5–2.0), placed directly below titleScale
- **`slide-templates.ts`** — Apply `subtitleScale` as inline `font-size` multiplier on subtitle elements in `renderCover()` and `renderSectionDivider()`

**Complexity:** Low — 3 files, follows existing pattern exactly.

---

## 2. Full Text Field Editing + Line Breaks

**Goal:** All text fields editable in the left panel. Enter = newline, rendered as `<br>` in slides.

### 2a. Missing Editors

Add editors to `slide-layout-editor.tsx` for currently uneditable fields:

| Field | UI | Slide Types |
|-------|-----|------------|
| `cards[].title` / `body` / `icon` | Collapsible card groups, each with input (title, icon) + textarea (body) | story-cards |
| `columns[0].title` / `body` / `items` | "Left Column" / "Right Column" groups, each with input (title) + textarea (body) + textarea (items, one per line) | two-column |
| `bigNumber.value` / `label` | Two inputs side by side | dataviz (big-number) |
| `stats[].value` / `label` | Repeatable row with two inputs | dataviz (stats-row) |
| `speakerNotes` | Textarea, shown for ALL slide types, placed at bottom of editor | all |
| `imagePrompt` | Textarea, shown for ALL slide types, below speakerNotes, labeled "AI Image Prompt" | all |

**Editor field list update** (`getRelevantFields`):
- `story-cards`: add `cards`
- `two-column`: add `columns` (already listed but no editor rendered)
- `dataviz`: `bigNumber`, `stats` (already listed but no editor rendered)
- ALL types: add `speakerNotes`, `imagePrompt` (outside of `getRelevantFields`, always rendered)

### 2b. Line Break Rendering

- Add `nl2br(str: string): string` helper in `slide-templates.ts` — converts `\n` to `<br>` AFTER `esc()` has been applied
- Apply `nl2br(esc(...))` to all text outputs: title, subtitle, body, card body, column body, items desc, quote text, footnote
- Single-line fields (badge, bigNumber value/label, stats value/label, card icon) stay as plain `esc()` — no line breaks needed

---

## 3. Prompt Tuning

**Goal:** Improve LLM output quality with two changes to the system prompt.

### 3a. items[] vs body

Modify system prompt in `api/presentations/generate/route.ts`:

> **Rule:** Sequential content (steps, processes, lists, comparisons) MUST use `items[]` array, NOT `body`. Reserve `body` for pure narrative paragraphs only. Never put numbered lists (1. 2. 3.) inside `body`.

### 3b. imagePrompt per slide

Modify system prompt to require:

> **Rule:** Every slide MUST include `imagePrompt: string` — a concrete, English-language description of an illustration suitable for this slide. Describe the visual concept, style, and key elements. This will be used for AI image generation.

**Type change:** Add `imagePrompt?: string` to `SlideContent` interface in `presentations-store.ts`.

**Refine route:** Update `api/presentations/refine/route.ts` system prompt with the same rules so refinements also follow them.

---

## 4. Section Divider — Leverage Right Side

**Decision:** Do NOT modify the section-divider template.

**Implementation:** Add prompt guidance only:

> Section dividers can use split layout (split-horizontal, split-vertical) to fill the right side. When content suggests a visual element, set layout.mode to "split-horizontal" and provide an imagePrompt. Otherwise, keep default layout.

This leverages existing V3.2 split layout infrastructure without any template changes.

---

## 5. Content Fidelity Test

**Goal:** Validate that prompt changes from #3 produce faithful, complete output.

**Process (manual, no code):**
1. Use a PDF from `~/Downloads/` as source
2. Generate presentation with updated prompts
3. Check every slide for:
   - No fabricated data/statistics
   - No empty fields that should have content
   - `items[]` used correctly for list content (not stuffed into `body`)
   - `imagePrompt` present on every slide
   - `speakerNotes` present and relevant
4. If issues found, iterate on prompt wording

---

## 6. PDF Export Bug Fix

**Symptom:** "PDF" button (printer icon) does nothing when clicked.

**Current code:** `iframeRef.current?.contentWindow?.print()` in `slide-preview.tsx:84-86`

**Investigation needed:**
- Check iframe src type (srcdoc vs blob URL vs http URL)
- Check if cross-origin restrictions apply
- Check if iframe is loaded when button is clicked

**Likely fixes (in priority order):**
1. If using `srcdoc`: should work — check if iframe ref is null at click time
2. If cross-origin: switch to opening content in new window via `window.open()` + `document.write()` + `window.print()`
3. Add `onLoad` guard to ensure iframe is ready before enabling button

---

## Out of Scope (V3.5)

- **LLM adapter abstraction layer** — extract `spawn("claude")` into adapter supporting Anthropic SDK / OpenAI / other CLIs
- **AI task logging** — log each generation/refinement to Obsidian with token usage
- **Dashboard task log widget** — visualize AI task history
- **Felo API image generation** — auto-generate images from imagePrompt

---

## Technical Notes

- Only 2 files depend on Claude CLI: `generate/route.ts`, `refine/route.ts`
- PDF parsing uses system `pdftotext` (poppler), not npm packages
- iframe slide preservation uses `_suppressNotify` + `onLoad` pattern (fixed in V3.2)
- All text rendering goes through `slide-templates.ts` — line break handling centralized there
- `imagePrompt` is a pure string for V3.4; future versions may add `imageGenerated?: { url, provider, timestamp }`
