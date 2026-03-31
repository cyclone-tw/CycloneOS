# Content Fidelity + Speaker Notes + GitHub Export

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix slide content to faithfully extract from source material (no AI hallucination), add per-slide speaker notes, and enable one-click GitHub push.

**Architecture:** Two-stage generation (extract key points → build outline), new `speakerNotes` field on SlideDefinition, Markdown export utility, GitHub push via git CLI.

**Tech Stack:** TypeScript, Next.js API routes, Claude CLI, git CLI

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `dashboard/src/app/api/presentations/generate/route.ts` | Rewrite | Two-stage prompt, speaker notes generation |
| `dashboard/src/stores/presentations-store.ts` | Modify | Add `speakerNotes` to SlideDefinition |
| `dashboard/src/lib/presentations-utils.ts` | Modify | Add `outlineToSpeakerNotes()` Markdown export |
| `dashboard/src/components/skills/workstations/presentations/slide-preview.tsx` | Modify | Add speaker notes export + GitHub push buttons |
| `dashboard/src/app/api/presentations/push-github/route.ts` | Create | API route for git push |

---

## Task 1: Add speakerNotes to data model

**Files:**
- Modify: `dashboard/src/stores/presentations-store.ts`

- [ ] **Step 1: Add speakerNotes to SlideDefinition**

Find:
```typescript
export interface SlideDefinition {
  id: string;
  order: number;
  content: SlideContent;
  animation?: SlideAnimation;
}
```

Replace with:
```typescript
export interface SlideDefinition {
  id: string;
  order: number;
  content: SlideContent;
  animation?: SlideAnimation;
  speakerNotes?: string;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /Users/username/CycloneOpenClaw/dashboard && npx tsc --noEmit --pretty 2>&1 | head -10`

- [ ] **Step 3: Commit**

```
feat(presentations): add speakerNotes field to SlideDefinition
```

---

## Task 2: Rewrite outline generation prompt for content fidelity

**Files:**
- Rewrite: `dashboard/src/app/api/presentations/generate/route.ts`

- [ ] **Step 1: Replace SLIDE_OUTLINE_PROMPT with two-stage prompt**

The new prompt enforces source fidelity through a structured extraction step:

```typescript
const SLIDE_OUTLINE_PROMPT = (
  sourceContent: string,
  instructions: string,
  themeName?: string,
  themePrompt?: string,
) => `<role>You are a presentation outline generator that creates slides STRICTLY from provided source material. You MUST respond with ONLY a JSON object.</role>

${sourceContent}

<task>${instructions || "Create a professional presentation based on the source material."}</task>

<CRITICAL-RULES>
## Content Fidelity (MANDATORY)

1. **ONLY use content from <sources>** — every fact, quote, number, and example in your slides MUST come directly from the source material
2. **NEVER fabricate data** — if the source doesn't contain statistics, percentages, or numbers, do NOT invent them. Use content/story-cards slides instead of dataviz
3. **NEVER use your general AI knowledge** — even if you know more about the topic, only use what the source provides
4. **Preserve specific examples** — if the source gives concrete examples, use those exact examples, not generic versions
5. **Use actual quotes** — if the source contains notable quotes, use them verbatim in quote slides
6. **Empty fields are forbidden** — every items[], columns[], cards[] must have actual text content. If you don't have content for a field, don't use that slide type

## Before generating slides, mentally extract from the source:
- Section headings and structure
- Key arguments and claims (with supporting details)
- Specific examples and case studies
- Actual data, numbers, statistics (if any)
- Notable quotes with attribution
- Comparisons and contrasts
- Conclusions and takeaways
</CRITICAL-RULES>

<slide-types>
| slideType | Variants | Purpose | When to use |
|-----------|----------|---------|-------------|
| cover | gradient, clean | Title slide | Always first |
| section-divider | dark, accent | Chapter separator | Between major sections |
| content | bullets, numbered, paragraph | Key points with details | When source has listed items or explanations |
| two-column | text-text, text-list | Side-by-side comparison | When source explicitly compares two things |
| dataviz | horizontal-bars, big-number, stats-row, comparison | Data visualization | ONLY when source contains actual numbers |
| quote | fullscreen, card-overlay, simple | Direct quotation | ONLY when source contains an actual quote |
| story-cards | grid-3, grid-2, single | Feature/concept cards | When source describes 2-3 parallel concepts |
| closing | summary, thank-you | End slide | Always last |
</slide-types>

<content-fields>
Each slide "content" object fields (use only what's needed):
- title (string): slide title — derived from source section heading
- subtitle (string): secondary text
- body (string): paragraph text — use source's actual wording
- badge (string): cover badge text
- items (array): [{label, value?, desc?}] — each item MUST have a non-empty label
- columns (array of 2): [{title?, items?, body?}] — each column MUST have content
- quote (object): {text, author?, source?} — MUST be a real quote from the source
- cards (array): [{title, body, icon?}] — each card MUST have title and body
- bigNumber (object): {value, label} — ONLY use real numbers from source
- stats (array): [{value, label}] — ONLY use real statistics from source
- footnote (string): source attribution
</content-fields>

<speaker-notes>
For EACH slide, include a "speakerNotes" field with 3-5 bullet points the presenter should mention.
These should include:
- The key message of this slide
- Additional context from the source that didn't fit on the slide
- Transition cues to the next slide
- Specific examples or anecdotes from the source to elaborate on
Format: bullet points separated by newlines, each starting with "- "
</speaker-notes>

${themeName ? `<theme>${themeName} — ${themePrompt ?? ""}</theme>` : ""}

<format>Respond with ONLY this JSON structure:
{"title":"string","slides":[{"id":"1","order":0,"content":{"slideType":"cover","variant":"gradient","title":"..."},"speakerNotes":"- point 1\\n- point 2\\n- point 3"}]}

Rules:
- Slide count should match source depth — don't pad with filler
- Pack related content into ONE slide
- Each slide must have substantial content from the source
- Vary slide types — don't repeat the same type 3+ times in a row
- Content language: match source language
- Every text field must contain actual content from the source
</format>`;
```

- [ ] **Step 2: Increase source truncation limit**

Find:
```typescript
const truncated = content.length > 30000 ? content.slice(0, 30000) + "\n...(truncated)" : content;
```

Replace with:
```typescript
const truncated = content.length > 60000 ? content.slice(0, 60000) + "\n...(truncated)" : content;
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd /Users/username/CycloneOpenClaw/dashboard && npx tsc --noEmit --pretty 2>&1 | head -10`

- [ ] **Step 4: Commit**

```
feat(presentations): rewrite outline prompt for content fidelity + speaker notes

- Two-stage extraction: extract key points from source before generating slides
- CRITICAL-RULES block forbids AI hallucination and fabricated data
- Speaker notes: 3-5 bullet points per slide from source material
- Increased source truncation limit to 60K chars
- Empty fields explicitly forbidden
```

---

## Task 3: Speaker notes Markdown export

**Files:**
- Modify: `dashboard/src/lib/presentations-utils.ts`

- [ ] **Step 1: Add outlineToSpeakerNotes function**

Add this export to `presentations-utils.ts`:

```typescript
/**
 * Convert SlideOutline to a speaker notes Markdown document.
 */
export function outlineToSpeakerNotes(outline: SlideOutline): string {
  const sorted = [...outline.slides].sort((a, b) => a.order - b.order);
  const lines: string[] = [
    `# ${outline.title} — 講稿`,
    "",
    `> 共 ${sorted.length} 頁投影片`,
    "",
    "---",
    "",
  ];

  for (const slide of sorted) {
    const num = slide.order + 1;
    const title = slide.content.title || slide.content.subtitle || `Slide ${num}`;
    const typeLabel = slide.content.slideType;

    lines.push(`## 第 ${num} 頁：${title}`);
    lines.push("");
    lines.push(`> 類型：${typeLabel} / ${slide.content.variant}`);
    lines.push("");

    if (slide.speakerNotes) {
      lines.push(slide.speakerNotes);
    } else {
      lines.push("_（無講稿）_");
    }

    lines.push("");
    lines.push("---");
    lines.push("");
  }

  return lines.join("\n");
}
```

- [ ] **Step 2: Verify TypeScript compiles**

- [ ] **Step 3: Commit**

```
feat(presentations): add speaker notes Markdown export utility
```

---

## Task 4: Export buttons UI (speaker notes + GitHub push)

**Files:**
- Modify: `dashboard/src/components/skills/workstations/presentations/slide-preview.tsx`

- [ ] **Step 1: Add import for outlineToSpeakerNotes**

```typescript
import { outlineToHtml, outlineToSpeakerNotes } from "@/lib/presentations-utils";
```

- [ ] **Step 2: Add speaker notes export handler**

After `handleExportPDF`:

```typescript
  const handleExportNotes = () => {
    if (!session) return;
    const md = outlineToSpeakerNotes(session.outline);
    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${session.outline.title || "presentation"}-notes.md`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
  };
```

- [ ] **Step 3: Add GitHub push handler**

```typescript
  const [isPushing, setIsPushing] = useState(false);

  const handlePushGitHub = async () => {
    if (!session || isPushing) return;
    setIsPushing(true);
    try {
      const res = await fetch("/api/presentations/push-github", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: session.outline.title || "presentation",
          html,
          speakerNotes: outlineToSpeakerNotes(session.outline),
        }),
      });
      const result = await res.json();
      if (result.success) {
        alert(`已推送到 GitHub：${result.path}`);
      } else {
        alert(`推送失敗：${result.error}`);
      }
    } catch (e) {
      alert(`推送失敗：${e instanceof Error ? e.message : "未知錯誤"}`);
    } finally {
      setIsPushing(false);
    }
  };
```

- [ ] **Step 4: Add import for useState and Loader2 (if not already imported)**

Add `useState` to the React import, and `Github` from lucide-react:

```typescript
import { useEffect, useRef, useMemo, useCallback, useState } from "react";
import { Download, RotateCcw, Play, Printer, FileText, Github, Loader2 } from "lucide-react";
```

- [ ] **Step 5: Add buttons to toolbar**

Add after the PDF button and before the 演示 button:

```tsx
          <button
            onClick={handleExportNotes}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-cy-muted hover:bg-cy-input/50 hover:text-cy-text transition-colors"
            title="匯出講稿"
          >
            <FileText className="h-3 w-3" />
            講稿
          </button>
          <button
            onClick={handlePushGitHub}
            disabled={isPushing}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-cy-muted hover:bg-cy-input/50 hover:text-cy-text transition-colors disabled:opacity-40"
            title="推送到 GitHub"
          >
            {isPushing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Github className="h-3 w-3" />}
            GitHub
          </button>
```

- [ ] **Step 6: Verify TypeScript compiles**

- [ ] **Step 7: Commit**

```
feat(presentations): add speaker notes export + GitHub push buttons
```

---

## Task 5: GitHub push API route

**Files:**
- Create: `dashboard/src/app/api/presentations/push-github/route.ts`

- [ ] **Step 1: Create the API route**

```typescript
// dashboard/src/app/api/presentations/push-github/route.ts
import { mkdir, writeFile } from "fs/promises";
import { execSync } from "child_process";
import { join } from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Configure: the repo where presentations are pushed
const PRESENTATIONS_REPO = process.env.PRESENTATIONS_REPO || "CyclonePresentations";
const PRESENTATIONS_DIR = process.env.PRESENTATIONS_DIR || join(process.env.HOME || "/tmp", "CyclonePresentations");

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fff]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export async function POST(request: Request) {
  try {
    const { title, html, speakerNotes } = await request.json();

    if (!title || !html) {
      return Response.json({ error: "Missing title or html" }, { status: 400 });
    }

    const date = new Date().toISOString().slice(0, 10);
    const folderName = `${date}-${slugify(title)}`;
    const folderPath = join(PRESENTATIONS_DIR, folderName);

    // Ensure repo exists and is up to date
    try {
      execSync(`git -C "${PRESENTATIONS_DIR}" rev-parse --git-dir`, { stdio: "pipe" });
      execSync(`git -C "${PRESENTATIONS_DIR}" pull --rebase 2>/dev/null || true`, { stdio: "pipe" });
    } catch {
      // Clone or init repo
      try {
        execSync(`gh repo clone ${PRESENTATIONS_REPO} "${PRESENTATIONS_DIR}"`, { stdio: "pipe" });
      } catch {
        await mkdir(PRESENTATIONS_DIR, { recursive: true });
        execSync(`git -C "${PRESENTATIONS_DIR}" init`, { stdio: "pipe" });
        execSync(`gh repo create ${PRESENTATIONS_REPO} --private --source="${PRESENTATIONS_DIR}" --push`, { stdio: "pipe" });
      }
    }

    // Create presentation folder and files
    await mkdir(folderPath, { recursive: true });
    await writeFile(join(folderPath, "index.html"), html, "utf-8");
    await writeFile(join(folderPath, "speaker-notes.md"), speakerNotes, "utf-8");

    // Git add, commit, push
    execSync(`git -C "${PRESENTATIONS_DIR}" add "${folderName}"`, { stdio: "pipe" });
    execSync(
      `git -C "${PRESENTATIONS_DIR}" commit -m "add: ${title}"`,
      { stdio: "pipe" },
    );
    execSync(`git -C "${PRESENTATIONS_DIR}" push`, { stdio: "pipe" });

    return Response.json({
      success: true,
      path: folderName,
      repo: PRESENTATIONS_REPO,
    });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 },
    );
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

- [ ] **Step 3: Commit**

```
feat(presentations): add GitHub push API route — auto-create repo folder + push
```

---

## Task 6: Build verification

- [ ] **Step 1: Full TypeScript check**

Run: `cd /Users/username/CycloneOpenClaw/dashboard && npx tsc --noEmit --pretty`

- [ ] **Step 2: Build**

Run: `cd /Users/username/CycloneOpenClaw/dashboard && npm run build 2>&1 | tail -10`

- [ ] **Step 3: Test with a real PDF source**

Manual test: Upload the OpenClaw PDF, generate a new presentation, and verify:
1. Content comes from the PDF, not AI general knowledge
2. No fabricated numbers
3. No empty slides
4. Speaker notes are present on each slide
5. Export speaker notes as MD works
6. GitHub push creates the folder and pushes

- [ ] **Step 4: Commit**

```
feat(presentations): V3.3 complete — content fidelity + speaker notes + GitHub export
```
