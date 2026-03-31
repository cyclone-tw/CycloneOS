# Slide Engine V3.4 — Editor Polish + Prompt Tuning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Polish the slide editor with full field editing, line breaks, subtitle scaling, prompt improvements, and PDF export fix.

**Architecture:** All changes are in the existing presentations feature. Types → CSS → Templates → Editor UI → API prompts. No new files needed except splitting the editor into a sub-component for complex field editors.

**Tech Stack:** Next.js, React, TypeScript, Zustand store, Claude CLI (spawn)

**Spec:** `docs/superpowers/specs/2026-03-28-slide-engine-v34-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `dashboard/src/stores/presentations-store.ts` | Modify | Add `subtitleScale` to CustomParams, `imagePrompt` to SlideContent |
| `dashboard/src/lib/slide-engine-css.ts` | Modify | Use `subtitleScale` instead of `titleScale` for subtitle font sizes |
| `dashboard/src/lib/slide-templates.ts` | Modify | Add `nl2br()` helper, apply to all text outputs |
| `dashboard/src/components/skills/workstations/presentations/slide-layout-editor.tsx` | Modify | Add editors for cards, columns, bigNumber, stats, speakerNotes, imagePrompt |
| `dashboard/src/components/skills/workstations/presentations/style-settings-panel.tsx` | Modify | Add subtitleScale slider |
| `dashboard/src/app/api/presentations/generate/route.ts` | Modify | Prompt tuning: items[] rule, imagePrompt rule, section divider guidance |
| `dashboard/src/app/api/presentations/refine/route.ts` | Modify | Same prompt rules for refine |
| `dashboard/src/components/skills/workstations/presentations/slide-preview.tsx` | Modify | Fix PDF export |

---

### Task 1: Add subtitleScale to type system and CSS

**Files:**
- Modify: `dashboard/src/stores/presentations-store.ts:45-51` (CustomParams interface)
- Modify: `dashboard/src/stores/presentations-store.ts:93-99` (DEFAULT_CUSTOM_PARAMS)
- Modify: `dashboard/src/lib/slide-engine-css.ts:315-322` (params defaults + subtitleSize)

- [ ] **Step 1: Add `subtitleScale` to CustomParams interface**

In `dashboard/src/stores/presentations-store.ts`, add `subtitleScale` to the interface:

```typescript
export interface CustomParams {
  titleScale: number;    // 0.5 ~ 2.0, default 1.0
  subtitleScale: number; // 0.5 ~ 2.0, default 1.0
  bodyScale: number;     // 0.5 ~ 2.0
  cardScale: number;     // 0.5 ~ 2.0
  spacingScale: number;  // 0.5 ~ 2.0
  badgeScale: number;    // 0.5 ~ 2.0, default 1.0
}
```

- [ ] **Step 2: Add default value**

In same file, update `DEFAULT_CUSTOM_PARAMS`:

```typescript
export const DEFAULT_CUSTOM_PARAMS: CustomParams = {
  titleScale: 1.0,
  subtitleScale: 1.0,
  bodyScale: 1.0,
  cardScale: 1.0,
  spacingScale: 1.0,
  badgeScale: 1.0,
};
```

- [ ] **Step 3: Update CSS to use subtitleScale**

In `dashboard/src/lib/slide-engine-css.ts`, update the params fallback (line 315-317) and subtitleSize (line 322):

```typescript
const params: CustomParams = settings?.customParams ?? {
  titleScale: 1, subtitleScale: 1, bodyScale: 1, cardScale: 1, spacingScale: 1, badgeScale: 1,
};
```

```typescript
const subtitleSize = scaledPx(28, params.subtitleScale);
```

Also update `.cover .subtitle` (search for `subtitle` in the CSS template) and `.section-label` to use `subtitleSize` instead of any titleScale-derived value.

- [ ] **Step 4: Add subtitleScale slider to UI**

In `dashboard/src/components/skills/workstations/presentations/style-settings-panel.tsx`, add after the titleScale slider (line 124):

```tsx
<ParamSlider
  label="副標大小"
  value={customParams.subtitleScale}
  onChange={(v) => setCustomParam("subtitleScale", v)}
/>
```

- [ ] **Step 5: Verify in browser**

Run: `cd dashboard && npm run dev`
Open the presentations workstation, create or load a presentation, check:
- New "副標大小" slider appears between "標題大小" and "內文大小"
- Moving the slider changes subtitle font size in preview
- Default value shows 100%

- [ ] **Step 6: Commit**

```bash
git add dashboard/src/stores/presentations-store.ts dashboard/src/lib/slide-engine-css.ts dashboard/src/components/skills/workstations/presentations/style-settings-panel.tsx
git commit -m "feat(presentations): add subtitleScale slider for independent subtitle sizing"
```

---

### Task 2: Add nl2br helper and apply line breaks to all templates

**Files:**
- Modify: `dashboard/src/lib/slide-templates.ts:11-19` (add nl2br after esc)

- [ ] **Step 1: Add `nl2br()` helper**

In `dashboard/src/lib/slide-templates.ts`, add after the `esc()` function (after line 19):

```typescript
/** Convert newlines to <br> tags. Apply AFTER esc() to avoid escaping the <br>. */
function nl2br(str: string): string {
  return str.replace(/\n/g, "<br>");
}
```

- [ ] **Step 2: Apply nl2br to renderCover**

Update `renderCover` (line 45-55). Replace `esc()` calls on title, subtitle, footnote:

```typescript
function renderCover(slide: SlideContent, index: number): string {
  const variant = slide.variant || "gradient";
  return `<div class="slide cover ${variant}${overlayClass(slide)}" data-index="${index}"${bgStyle(slide)}>
  <div class="slide-inner cover-inner">
    ${badgeHtml(slide)}
    ${slide.title ? frag(`<h1>${nl2br(esc(slide.title))}</h1>`) : ""}
    ${slide.subtitle ? frag(`<p class="subtitle">${nl2br(esc(slide.subtitle))}</p>`) : ""}
    ${slide.footnote ? frag(`<p class="footnote">${nl2br(esc(slide.footnote))}</p>`) : ""}
  </div>
</div>`;
}
```

- [ ] **Step 3: Apply nl2br to renderSectionDivider**

```typescript
function renderSectionDivider(slide: SlideContent, index: number): string {
  const variant = slide.variant || "dark";
  return `<div class="slide section-divider ${variant}${overlayClass(slide)}" data-index="${index}"${bgStyle(slide)}>
  <div class="slide-inner section-divider-inner">
    ${slide.subtitle ? frag(`<p class="section-label">${nl2br(esc(slide.subtitle))}</p>`) : ""}
    ${slide.title ? frag(`<h2 class="section-title">${nl2br(esc(slide.title))}</h2>`) : ""}
  </div>
</div>`;
}
```

- [ ] **Step 4: Apply nl2br to renderContent**

In `renderContent`, update body text and item desc:

```typescript
// In the bullets/numbered map, update desc:
`<span class="item-desc"> — ${nl2br(esc(item.desc))}</span>`

// In paragraph variant:
bodyHtml = frag(`<p class="body-text">${nl2br(esc(slide.body))}</p>`);
```

- [ ] **Step 5: Apply nl2br to renderTwoColumn**

In the `renderColumn` helper inside `renderTwoColumn`:

```typescript
if (col.title) inner += `<h3 class="col-title">${nl2br(esc(col.title))}</h3>`;
// items desc:
`<span class="item-desc"> — ${nl2br(esc(item.desc))}</span>`
// body:
if (col.body) inner += `<p class="col-body">${nl2br(esc(col.body))}</p>`;
```

- [ ] **Step 6: Apply nl2br to renderDataviz**

In `renderDataviz`, update big-number label, body, and bar labels where multi-line might help:

```typescript
// big-number body:
vizHtml += frag(`<p class="body-text">${nl2br(esc(slide.body))}</p>`);
```

- [ ] **Step 7: Apply nl2br to renderQuote**

```typescript
${frag(`<blockquote>
  <p class="quote-text">${nl2br(esc(q.text))}</p>
  ${q.author ? `<cite class="quote-author">— ${esc(q.author)}${q.source ? `, ${esc(q.source)}` : ""}</cite>` : ""}
</blockquote>`)}
${slide.body ? frag(`<p class="body-text">${nl2br(esc(slide.body))}</p>`) : ""}
```

- [ ] **Step 8: Apply nl2br to renderStoryCards**

```typescript
frag(`<div class="story-card">
  ${card.icon ? `<span class="card-icon">${esc(card.icon)}</span>` : ""}
  <h3 class="card-title">${nl2br(esc(card.title))}</h3>
  <p class="card-body">${nl2br(esc(card.body))}</p>
</div>`)
```

- [ ] **Step 9: Apply nl2br to renderClosing**

```typescript
${slide.title ? frag(`<h1>${nl2br(esc(slide.title))}</h1>`) : ""}
${slide.body ? frag(`<p class="cta-text">${nl2br(esc(slide.body))}</p>`) : ""}
${slide.footnote ? frag(`<p class="footnote">${nl2br(esc(slide.footnote))}</p>`) : ""}
```

- [ ] **Step 10: Verify in browser**

Open a presentation, edit a title field, type text with Enter to add newlines. Check that `<br>` tags render in the preview iframe.

- [ ] **Step 11: Commit**

```bash
git add dashboard/src/lib/slide-templates.ts
git commit -m "feat(presentations): add nl2br helper for line break rendering in all templates"
```

---

### Task 3: Add imagePrompt to SlideContent type

**Files:**
- Modify: `dashboard/src/stores/presentations-store.ts:107-125` (SlideContent interface)

- [ ] **Step 1: Add imagePrompt field**

In `dashboard/src/stores/presentations-store.ts`, add `imagePrompt` to `SlideContent`:

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
  imagePrompt?: string;
  backgroundImage?: BackgroundImage;
  layout?: SlideLayout;
  badgePosition?: BadgePosition;
  textAlign?: TextAlign;
}
```

- [ ] **Step 2: Commit**

```bash
git add dashboard/src/stores/presentations-store.ts
git commit -m "feat(presentations): add imagePrompt field to SlideContent type"
```

---

### Task 4: Add missing field editors to slide-layout-editor

**Files:**
- Modify: `dashboard/src/components/skills/workstations/presentations/slide-layout-editor.tsx:59-191`

This is the largest task. We need editors for: cards, columns, bigNumber, stats, speakerNotes, imagePrompt.

- [ ] **Step 1: Add cards editor (story-cards)**

In `slide-layout-editor.tsx`, inside `ContentEditor`, add after the `items` editor block (after line 149) and before the `quote` block:

```tsx
{fields.includes("cards") && content.cards && (
  <div>
    <label className="text-xs text-cy-muted block mb-1">卡片</label>
    <div className="space-y-2">
      {content.cards.map((card, i) => (
        <div key={i} className="border border-cy-border/30 rounded-md p-2 space-y-1">
          <div className="flex items-center gap-1">
            <input
              type="text"
              value={card.icon ?? ""}
              onChange={(e) => {
                const newCards = [...content.cards!];
                newCards[i] = { ...newCards[i], icon: e.target.value };
                update({ cards: newCards });
              }}
              placeholder="Icon"
              className="w-12 rounded bg-cy-input px-1.5 py-1 text-xs text-cy-text border border-cy-border focus:outline-none focus:border-cy-accent text-center"
            />
            <input
              type="text"
              value={card.title}
              onChange={(e) => {
                const newCards = [...content.cards!];
                newCards[i] = { ...newCards[i], title: e.target.value };
                update({ cards: newCards });
              }}
              placeholder="標題"
              className="flex-1 rounded bg-cy-input px-1.5 py-1 text-xs text-cy-text border border-cy-border focus:outline-none focus:border-cy-accent"
            />
          </div>
          <textarea
            value={card.body}
            onChange={(e) => {
              const newCards = [...content.cards!];
              newCards[i] = { ...newCards[i], body: e.target.value };
              update({ cards: newCards });
            }}
            rows={2}
            placeholder="內容"
            className="w-full rounded bg-cy-input px-1.5 py-1 text-xs text-cy-text border border-cy-border focus:outline-none focus:border-cy-accent resize-none"
          />
        </div>
      ))}
    </div>
  </div>
)}
```

- [ ] **Step 2: Update getRelevantFields to include "cards" for story-cards**

The `getRelevantFields` function already returns `["title", "cards", "footnote"]` for `story-cards` (line 67). The field is listed, but there was no editor rendering for it. The code in Step 1 handles this since `fields.includes("cards")` will now match. No change needed to `getRelevantFields`.

- [ ] **Step 3: Add columns editor (two-column)**

Add after the cards editor block:

```tsx
{fields.includes("columns") && (
  <div>
    <label className="text-xs text-cy-muted block mb-1">欄位內容</label>
    {([0, 1] as const).map((colIdx) => {
      const col = content.columns?.[colIdx] ?? {};
      const updateCol = (updates: Record<string, unknown>) => {
        const cols: [Record<string, unknown>, Record<string, unknown>] = [
          { ...(content.columns?.[0] ?? {}) },
          { ...(content.columns?.[1] ?? {}) },
        ];
        cols[colIdx] = { ...cols[colIdx], ...updates };
        update({ columns: cols as SlideContent["columns"] });
      };
      return (
        <div key={colIdx} className="border border-cy-border/30 rounded-md p-2 space-y-1 mb-2">
          <span className="text-[10px] text-cy-muted uppercase">{colIdx === 0 ? "左欄" : "右欄"}</span>
          <input
            type="text"
            value={col.title ?? ""}
            onChange={(e) => updateCol({ title: e.target.value })}
            placeholder="欄標題"
            className="w-full rounded bg-cy-input px-1.5 py-1 text-xs text-cy-text border border-cy-border focus:outline-none focus:border-cy-accent"
          />
          <textarea
            value={col.body ?? ""}
            onChange={(e) => updateCol({ body: e.target.value })}
            rows={2}
            placeholder="內文"
            className="w-full rounded bg-cy-input px-1.5 py-1 text-xs text-cy-text border border-cy-border focus:outline-none focus:border-cy-accent resize-none"
          />
          <textarea
            value={(col.items ?? []).map((item: { label: string; desc?: string }) => item.label + (item.desc ? ` — ${item.desc}` : "")).join("\n")}
            onChange={(e) => {
              const items = e.target.value.split("\n").map((line: string) => {
                const [label, ...descParts] = line.split(" — ");
                return { label: label.trim(), desc: descParts.join(" — ").trim() || undefined };
              });
              updateCol({ items });
            }}
            rows={3}
            placeholder={"項目（每行一個）\n項目一 — 說明"}
            className="w-full rounded bg-cy-input px-1.5 py-1 text-xs text-cy-text border border-cy-border focus:outline-none focus:border-cy-accent resize-none placeholder:text-cy-muted/50"
          />
        </div>
      );
    })}
  </div>
)}
```

- [ ] **Step 4: Add bigNumber editor (dataviz big-number)**

Add after columns editor:

```tsx
{fields.includes("bigNumber") && content.slideType === "dataviz" && content.variant === "big-number" && (
  <div>
    <label className="text-xs text-cy-muted block mb-1">大數字</label>
    <div className="flex gap-2">
      <input
        type="text"
        value={content.bigNumber?.value ?? ""}
        onChange={(e) => update({ bigNumber: { value: e.target.value, label: content.bigNumber?.label ?? "" } })}
        placeholder="數值"
        className="w-24 rounded bg-cy-input px-1.5 py-1 text-xs text-cy-text border border-cy-border focus:outline-none focus:border-cy-accent"
      />
      <input
        type="text"
        value={content.bigNumber?.label ?? ""}
        onChange={(e) => update({ bigNumber: { value: content.bigNumber?.value ?? "", label: e.target.value } })}
        placeholder="標籤"
        className="flex-1 rounded bg-cy-input px-1.5 py-1 text-xs text-cy-text border border-cy-border focus:outline-none focus:border-cy-accent"
      />
    </div>
  </div>
)}
```

- [ ] **Step 5: Add stats editor (dataviz stats-row)**

Add after bigNumber editor:

```tsx
{fields.includes("stats") && content.slideType === "dataviz" && content.variant === "stats-row" && content.stats && (
  <div>
    <label className="text-xs text-cy-muted block mb-1">統計數據</label>
    <div className="space-y-1">
      {content.stats.map((stat, i) => (
        <div key={i} className="flex gap-2">
          <input
            type="text"
            value={stat.value}
            onChange={(e) => {
              const newStats = [...content.stats!];
              newStats[i] = { ...newStats[i], value: e.target.value };
              update({ stats: newStats });
            }}
            placeholder="數值"
            className="w-24 rounded bg-cy-input px-1.5 py-1 text-xs text-cy-text border border-cy-border focus:outline-none focus:border-cy-accent"
          />
          <input
            type="text"
            value={stat.label}
            onChange={(e) => {
              const newStats = [...content.stats!];
              newStats[i] = { ...newStats[i], label: e.target.value };
              update({ stats: newStats });
            }}
            placeholder="標籤"
            className="flex-1 rounded bg-cy-input px-1.5 py-1 text-xs text-cy-text border border-cy-border focus:outline-none focus:border-cy-accent"
          />
        </div>
      ))}
    </div>
  </div>
)}
```

- [ ] **Step 6: Add dataviz items editor (horizontal-bars + comparison)**

Currently, the items editor at line 132 is hidden for dataviz: `content.slideType !== "dataviz"`. For horizontal-bars, we need an items editor that includes value and color. Update the condition and add a dataviz-specific items editor:

```tsx
{fields.includes("items") && content.slideType === "dataviz" && (content.variant === "horizontal-bars" || content.variant === "comparison") && (
  <div>
    <label className="text-xs text-cy-muted block mb-1">數據項目</label>
    <div className="space-y-1">
      {(content.items ?? []).map((item, i) => (
        <div key={i} className="flex gap-1">
          <input
            type="text"
            value={item.label}
            onChange={(e) => {
              const newItems = [...(content.items ?? [])];
              newItems[i] = { ...newItems[i], label: e.target.value };
              update({ items: newItems });
            }}
            placeholder="標籤"
            className="flex-1 rounded bg-cy-input px-1.5 py-1 text-xs text-cy-text border border-cy-border focus:outline-none focus:border-cy-accent"
          />
          <input
            type="text"
            value={item.value ?? ""}
            onChange={(e) => {
              const newItems = [...(content.items ?? [])];
              newItems[i] = { ...newItems[i], value: e.target.value };
              update({ items: newItems });
            }}
            placeholder="數值"
            className="w-16 rounded bg-cy-input px-1.5 py-1 text-xs text-cy-text border border-cy-border focus:outline-none focus:border-cy-accent"
          />
        </div>
      ))}
    </div>
  </div>
)}
```

- [ ] **Step 7: Add speakerNotes and imagePrompt editors (all slide types)**

These go OUTSIDE the `getRelevantFields` check, at the bottom of `ContentEditor` return, before the closing `</div>`. They appear for ALL slide types.

Add right before the final `</div>` of the `ContentEditor` component's return (before line 189):

```tsx
{/* Speaker notes — all slide types */}
<div className="border-t border-cy-border/20 pt-2 mt-2">
  <label className="text-xs text-cy-muted block mb-1">講稿</label>
  <textarea
    value={slide.speakerNotes ?? ""}
    onChange={(e) => {
      const { updateSlideField } = usePresentationsStore.getState();
      updateSlideField(slide.id, "speakerNotes", e.target.value);
    }}
    rows={3}
    placeholder="演講者備註（每行一個要點）"
    className="w-full rounded-md bg-cy-input px-2 py-1.5 text-xs text-cy-text border border-cy-border focus:outline-none focus:border-cy-accent resize-none placeholder:text-cy-muted/50"
  />
</div>

{/* Image prompt — all slide types */}
<div>
  <label className="text-xs text-cy-muted block mb-1">AI 圖片提示</label>
  <textarea
    value={content.imagePrompt ?? ""}
    onChange={(e) => update({ imagePrompt: e.target.value })}
    rows={2}
    placeholder="描述適合此頁的插圖（英文佳）"
    className="w-full rounded-md bg-cy-input px-2 py-1.5 text-xs text-cy-text border border-cy-border focus:outline-none focus:border-cy-accent resize-none placeholder:text-cy-muted/50"
  />
</div>
```

- [ ] **Step 8: Add updateSlideField to presentations store**

The speakerNotes field is on `SlideDefinition`, not `SlideContent`, so `updateSlideContent` can't update it. Add a new store action.

In `dashboard/src/stores/presentations-store.ts`, find the store actions section and add:

```typescript
updateSlideField: (slideId: string, field: "speakerNotes", value: string) => {
  set((state) => {
    const session = getActive(state);
    if (!session) return state;
    return updateSession(state, session.id, {
      outline: {
        ...session.outline,
        slides: session.outline.slides.map((s) =>
          s.id === slideId ? { ...s, [field]: value } : s
        ),
      },
    });
  });
},
```

Also export it from the store's interface/type if needed.

- [ ] **Step 9: Verify all editors in browser**

Run dev server, create a presentation, check each slide type:
- story-cards: can edit each card's icon, title, body
- two-column: can edit left/right column title, body, items
- dataviz big-number: can edit value and label
- dataviz stats-row: can edit each stat's value and label
- dataviz horizontal-bars: can edit each item's label and value
- All slides: speakerNotes textarea visible at bottom
- All slides: imagePrompt textarea visible at bottom

- [ ] **Step 10: Commit**

```bash
git add dashboard/src/stores/presentations-store.ts dashboard/src/components/skills/workstations/presentations/slide-layout-editor.tsx
git commit -m "feat(presentations): add editors for cards, columns, bigNumber, stats, speakerNotes, imagePrompt"
```

---

### Task 5: Prompt tuning — items[] rule, imagePrompt, section divider guidance

**Files:**
- Modify: `dashboard/src/app/api/presentations/generate/route.ts:46-116` (system prompt)
- Modify: `dashboard/src/app/api/presentations/refine/route.ts:8-36` (refine prompt)

- [ ] **Step 1: Add items[] vs body rule to generate prompt**

In `dashboard/src/app/api/presentations/generate/route.ts`, add after the existing CRITICAL-RULES (after line 64, before `<slide-types>`):

```
## Content Structure Rules

7. **Sequential content MUST use items[]** — steps, processes, lists, comparisons, features → always use items[{label, desc}], NEVER put numbered lists (1. 2. 3.) inside body
8. **Reserve body for narrative paragraphs only** — body is for prose text, not structured content
9. **Every slide MUST include imagePrompt** — a concrete English description of an illustration for this slide. Describe visual concept, style, key elements. Example: "A neural network diagram with interconnected nodes, glowing blue pathways, dark background, technical illustration style"
```

- [ ] **Step 2: Add imagePrompt to content-fields and format sections**

In the `<content-fields>` section (line 79-92), add:

```
- imagePrompt (string): REQUIRED — English description of a suitable illustration for AI image generation
```

In the `<format>` JSON example (line 107), add `imagePrompt` to the example:

```json
{"id":"1","order":0,"content":{"slideType":"cover","variant":"gradient","title":"...","imagePrompt":"..."},"speakerNotes":"- point 1\\n- point 2"}
```

- [ ] **Step 3: Add section divider guidance**

In the `<slide-types>` table (line 67-77), update the section-divider row:

```
| section-divider | dark, accent | Chapter separator | Between major sections. Can use split layout for right-side content (image or summary). Provide imagePrompt for visual. |
```

- [ ] **Step 4: Update refine prompt with same rules**

In `dashboard/src/app/api/presentations/refine/route.ts`, update the `<rules>` section (line 23-33) to add:

```
- Sequential content (steps, lists, features) MUST use items[] array, NOT body. Reserve body for prose paragraphs only.
- Every slide MUST include imagePrompt (English description of suitable illustration)
- Preserve existing imagePrompt values unless the slide content changed significantly
```

- [ ] **Step 5: Verify prompt changes**

Read both files to confirm no syntax errors in the template literals.

- [ ] **Step 6: Commit**

```bash
git add dashboard/src/app/api/presentations/generate/route.ts dashboard/src/app/api/presentations/refine/route.ts
git commit -m "feat(presentations): prompt tuning — items[] rule, imagePrompt requirement, section divider guidance"
```

---

### Task 6: Fix PDF export button

**Files:**
- Modify: `dashboard/src/components/skills/workstations/presentations/slide-preview.tsx:84-86`

- [ ] **Step 1: Investigate current iframe setup**

Read `slide-preview.tsx` fully to understand how the iframe src is set. Check if it uses `srcDoc` or `src` with a blob URL. The `print()` call on `contentWindow` may fail if the iframe hasn't loaded or if cross-origin restrictions apply to blob URLs.

- [ ] **Step 2: Fix handleExportPDF**

Replace the current `handleExportPDF` (line 84-86) with an approach that opens a new window for printing, which avoids iframe cross-origin issues:

```typescript
const handleExportPDF = () => {
  if (!html) return;
  const printWindow = window.open("", "_blank");
  if (!printWindow) return;
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.addEventListener("load", () => {
    printWindow.print();
  });
};
```

This opens the full HTML in a new tab, then triggers print. The user can then "Save as PDF" from the print dialog. No cross-origin issues since the new window owns the document.

- [ ] **Step 3: Verify in browser**

Click the PDF button. A new tab should open with the presentation, and the print dialog should appear. User can select "Save as PDF".

- [ ] **Step 4: Commit**

```bash
git add dashboard/src/components/skills/workstations/presentations/slide-preview.tsx
git commit -m "fix(presentations): fix PDF export by opening print in new window instead of iframe"
```

---

### Task 7: Content fidelity test (manual verification)

**Files:** None — this is a manual test task using a real PDF.

- [ ] **Step 1: Find a test PDF**

```bash
ls ~/Downloads/*.pdf | head -5
```

Pick a PDF with structured content (sections, data, quotes if possible).

- [ ] **Step 2: Generate presentation from PDF**

Open the presentations workstation in the browser. Add the PDF as a source. Click generate. Wait for the outline to complete.

- [ ] **Step 3: Verify content fidelity**

Check each slide for:
- [ ] No fabricated statistics or percentages not in the source
- [ ] No empty `items[]`, `cards[]`, or `columns[]` fields
- [ ] Sequential content uses `items[]` (not numbered lists in `body`)
- [ ] `imagePrompt` is present on every slide
- [ ] `speakerNotes` is present and relevant
- [ ] Section dividers (if any) have meaningful content

- [ ] **Step 4: If issues found, iterate on prompts**

Go back to Task 5 and adjust prompt wording. Re-generate and re-check. Repeat until satisfied.

- [ ] **Step 5: Record test result**

Note the test outcome in the commit message or session log. No code commit needed for this task unless prompts were adjusted.
