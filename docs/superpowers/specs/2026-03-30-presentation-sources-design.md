# Presentation Sources Expansion — Paste Text + Deep Research + Import Research

**Date:** 2026-03-30
**Status:** Draft
**Previous:** Slide Engine V3.5 (plugin system + 5 new templates)

## Summary

Expand presentation source types from file-only to three additional input methods:
1. **Paste text** — direct text input as source material
2. **Deep research** — Felo API + Claude synthesis, auto-generates structured research as source
3. **Import research** — browse OpenClaw research outputs from Obsidian vault

---

## 1. SourceItem Type Expansion

### Current

```ts
interface SourceItem {
  id: string;
  type: "local" | "drive" | "notion" | "obsidian";
  path: string;
  name: string;
  isDirectory: boolean;
}
```

### New

```ts
interface SourceItem {
  id: string;
  type: "local" | "drive" | "notion" | "obsidian" | "text" | "research";
  path: string;
  name: string;
  isDirectory: boolean;
  textContent?: string;    // type="text": user-pasted text; type="research": synthesized research
  researchQuery?: string;  // type="research": original search query
}
```

### readSourceContents() Changes

In `dashboard/src/app/api/presentations/generate/route.ts`, the `readSourceContents()` function currently reads files from disk. Expand to handle new types:

```
For each source:
  if source has textContent → use textContent directly (no file read)
  else → read from path (existing behavior)
```

The generate route receives sources from the client. Currently it only receives `filePaths: string[]`. Change to receive full `SourceItem[]` so it can access `textContent` for text/research sources.

---

## 2. Source Panel UI

### File: `dashboard/src/components/skills/workstations/presentations/presentations-source-panel.tsx`

Add three new buttons in the source area toolbar:

```
[📁 新增來源] [📋 貼上文字] [🔍 研究] [📂 匯入研究]
```

### 📋 Paste Text

- Button toggles a textarea below the toolbar
- User pastes text, clicks "加入來源"
- Creates `SourceItem { type: "text", name: "貼上文字 #N", textContent: pastedText }`
- Textarea clears after adding
- Source list shows 📋 (ClipboardList) icon for text sources

### 🔍 Deep Research

- Button toggles a search input + "搜尋" button below the toolbar
- User enters a topic (e.g., "2026 AI 教育趨勢"), clicks "搜尋"
- Shows loading spinner with "研究中..."
- Calls `POST /api/presentations/research` with `{ query }`
- On success, creates `SourceItem { type: "research", name: "研究：{query}", textContent: result, researchQuery: query }`
- Input clears after adding
- Source list shows 🔍 (Search) icon for research sources

### 📂 Import Research

- Button opens SharedSourcePickerModal with path locked to Obsidian vault `Draco/research/`
- User browses and selects research files (markdown)
- Creates standard `SourceItem { type: "obsidian", path: selectedPath }`
- Source list shows existing 📚 (BookOpen) icon for obsidian sources

---

## 3. Research API Route

### File: `dashboard/src/app/api/presentations/research/route.ts`

**Endpoint:** `POST /api/presentations/research`

**Request:**
```json
{ "query": "2026 AI 教育趨勢" }
```

**Response:**
```json
{
  "content": "# 研究：2026 AI 教育趨勢\n\n## 重點摘要\n- ...\n\n## 關鍵數據\n...\n\n## 來源\n- [Title](URL)\n...",
  "sources": [
    { "title": "...", "url": "..." }
  ]
}
```

### Internal Flow

```
User query
    │
    ├── Step 1: Felo Chat API
    │   POST https://openapi.felo.ai/v2/chat
    │   Headers: { Authorization: Bearer $FELO_API_KEY, Content-Type: application/json }
    │   Body: { query }
    │   Response: { data: { answer, resources[] } }
    │
    └── Step 2: Claude Sonnet Synthesis
        Input: Felo answer + resources
        Prompt: "根據以下搜尋結果，整理成適合用於簡報的結構化研究摘要。
                 格式：重點摘要（bullet points）、關鍵數據（如有）、來源列表。
                 語言：與搜尋主題相同。"
        Output: Structured markdown
```

### Why Two Steps (Felo + Claude)

- Felo provides real-time web search with AI synthesis — gets the raw research content
- Claude Sonnet re-structures specifically for presentation use — extracts bullet points, data, quotes that map well to slide types
- This produces source material that the generate route can turn into good slides

### Environment Variable

```
# .env.local
FELO_API_KEY=your_felo_api_key_here
```

---

## 4. Source List Display Changes

### File: `dashboard/src/components/skills/workstations/shared/source-list.tsx`

Add icons for new source types:
- `"text"` → ClipboardList icon
- `"research"` → Search icon

Existing types unchanged:
- `"local"` → HardDrive
- `"drive"` → Cloud
- `"notion"` → BookOpen
- `"obsidian"` → BookOpen (or Archive)

---

## 5. Generate Route Changes

### File: `dashboard/src/app/api/presentations/generate/route.ts`

### Current

```ts
const { sources, instructions, theme, renderer, aspectRatio } = await req.json();
const filePaths = sources.map((s: any) => s.path);
const sourceContent = await readSourceContents(filePaths);
```

### New

```ts
const { sources, instructions, theme, renderer, aspectRatio } = await req.json();
const sourceContent = await readSourceContents(sources);
```

`readSourceContents` changes from `(filePaths: string[])` to `(sources: SourceItem[])`:

```ts
async function readSourceContents(sources: SourceItem[]): Promise<string> {
  const parts: string[] = [];
  for (const source of sources) {
    if (source.textContent) {
      // Text or research source — use textContent directly
      parts.push(`<file path="${source.name}">${truncate(source.textContent)}</file>`);
    } else if (source.path) {
      // File source — read from disk (existing logic)
      const content = await readFile(source.path);
      parts.push(`<file path="${source.path}">${truncate(content)}</file>`);
    }
  }
  return `<sources>${parts.join("\n")}</sources>`;
}
```

---

## 6. Files Changed Summary

| Action | File | What |
|--------|------|------|
| Modify | `stores/documents-store.ts` | Add "text" and "research" to SourceItem type, add textContent and researchQuery fields |
| Modify | `presentations-source-panel.tsx` | Add 3 new buttons + paste textarea + research input UI |
| Create | `api/presentations/research/route.ts` | New research endpoint (Felo + Claude) |
| Modify | `api/presentations/generate/route.ts` | readSourceContents accepts SourceItem[] instead of string[] |
| Modify | `shared/source-list.tsx` | Add icons for text and research types |
| Modify | `.env.local` | Add FELO_API_KEY |
