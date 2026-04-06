# Social Posting Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a social posting workstation that converts text/Obsidian knowledge into multi-platform social posts, using Notion as a content hub for future n8n automation.

**Architecture:** Left/right split workstation. Left panel: text input (direct or QMD search) + image upload + platform/tone selector. Right panel: tabbed preview per platform + copy/publish buttons + history list. API routes handle LLM generation (streaming SSE), Notion CRUD, and image upload. Notion Database acts as the central hub with per-platform content fields for n8n integration.

**Tech Stack:** Next.js App Router, Zustand, Notion API, CycloneOS LLM abstraction (`getLLMProvider`), Tailwind with cy-* theme tokens.

**Design Spec:** `docs/superpowers/specs/2026-04-06-social-posting-module-design.md`

---

## File Structure

```
src/
├── lib/
│   ├── notion-utils.ts              # Shared markdownToBlocks (extracted from yt-notes)
│   └── social/
│       ├── notion.ts                # Social-specific Notion API (create page, fetch history)
│       └── prompts.ts               # Per-platform prompt templates
├── stores/
│   └── social-store.ts             # Zustand store for social workstation state
├── app/api/social/
│   ├── generate/route.ts           # POST — LLM streaming generation
│   ├── publish-notion/route.ts     # POST — create Notion page
│   ├── history/route.ts            # GET — fetch recent posts from Notion DB
│   └── upload-image/route.ts       # POST — save images to public/uploads/social/
└── components/skills/workstations/social/
    ├── social-workstation.tsx       # Main container (left/right split)
    ├── source-input.tsx            # Text source: direct input or QMD search
    ├── image-uploader.tsx          # Drag-and-drop image upload
    ├── platform-selector.tsx       # Platform checkboxes + tone + generate button
    ├── platform-preview.tsx        # Tabbed preview per platform + copy/publish
    └── post-history.tsx            # Recent posts from Notion
```

---

### Task 1: Create Notion Database + Add Env Var

**Files:**
- Create: `scripts/social/create-notion-db.ts`
- Modify: `.env.local` (add `NOTION_SOCIAL_DATABASE_ID`)

- [ ] **Step 1: Write the database creation script**

```ts
// scripts/social/create-notion-db.ts
//
// One-time script to create the Social Posts Notion database.
// Usage: npx tsx scripts/social/create-notion-db.ts
//
// Requires NOTION_API_KEY in .env.local
// The database will be created as a top-level page in the workspace.

import "dotenv/config";

const NOTION_API = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";
const API_KEY = process.env.NOTION_API_KEY;

if (!API_KEY) {
  console.error("Missing NOTION_API_KEY in .env.local");
  process.exit(1);
}

async function createDatabase() {
  // Step 1: Find a parent page to put the database under.
  // Search for a page named "CycloneOS" or use the first available page.
  const searchRes = await fetch(`${NOTION_API}/search`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: "CycloneOS",
      filter: { value: "page", property: "object" },
      page_size: 5,
    }),
  });

  const searchData = await searchRes.json();
  const parentPage = searchData.results?.[0];

  if (!parentPage) {
    console.error("No parent page found. Create a 'CycloneOS' page in Notion first, or share any page with the integration.");
    process.exit(1);
  }

  console.log(`Using parent page: ${parentPage.id}`);

  // Step 2: Create the database
  const dbBody = {
    parent: { page_id: parentPage.id },
    title: [{ text: { content: "社群發文" } }],
    properties: {
      Title: { title: {} },
      Status: {
        status: {
          options: [
            { name: "草稿", color: "gray" },
            { name: "待發布", color: "yellow" },
            { name: "已發布", color: "green" },
            { name: "失敗", color: "red" },
          ],
        },
      },
      Platforms: {
        multi_select: {
          options: [
            { name: "FB", color: "blue" },
            { name: "IG", color: "purple" },
            { name: "LINE", color: "green" },
            { name: "學校網站", color: "orange" },
            { name: "Notion", color: "default" },
          ],
        },
      },
      Published: {
        multi_select: {
          options: [
            { name: "FB", color: "blue" },
            { name: "IG", color: "purple" },
            { name: "LINE", color: "green" },
            { name: "學校網站", color: "orange" },
            { name: "Notion", color: "default" },
          ],
        },
      },
      "Publish Date": { date: {} },
      Tags: {
        multi_select: {
          options: [
            { name: "特教宣導", color: "blue" },
            { name: "IEP技巧", color: "green" },
            { name: "活動紀錄", color: "yellow" },
            { name: "研習心得", color: "purple" },
            { name: "法規更新", color: "red" },
          ],
        },
      },
      Tone: {
        select: {
          options: [
            { name: "知識分享", color: "blue" },
            { name: "日常", color: "green" },
            { name: "活動宣傳", color: "yellow" },
          ],
        },
      },
      Source: { rich_text: {} },
      "Content FB": { rich_text: {} },
      "Content IG": { rich_text: {} },
      "Content LINE": { rich_text: {} },
      "Content School": { rich_text: {} },
      Hashtags: { rich_text: {} },
      "Image URLs": { rich_text: {} },
      "Error Log": { rich_text: {} },
    },
  };

  const createRes = await fetch(`${NOTION_API}/databases`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(dbBody),
  });

  if (!createRes.ok) {
    const err = await createRes.text();
    console.error("Failed to create database:", createRes.status, err);
    process.exit(1);
  }

  const db = await createRes.json();
  console.log(`\n✅ Database created!`);
  console.log(`   ID: ${db.id}`);
  console.log(`   URL: ${db.url}`);
  console.log(`\nAdd this to .env.local:`);
  console.log(`NOTION_SOCIAL_DATABASE_ID=${db.id.replace(/-/g, "")}`);
}

createDatabase().catch(console.error);
```

- [ ] **Step 2: Run the script to create the database**

```bash
npx tsx scripts/social/create-notion-db.ts
```

Expected: Outputs the database ID and URL.

- [ ] **Step 3: Add the database ID to .env.local**

Add the output ID to `.env.local`:

```
NOTION_SOCIAL_DATABASE_ID=<the-id-from-step-2>
```

- [ ] **Step 4: Commit**

```bash
git add scripts/social/create-notion-db.ts
git commit -m "feat(social): add Notion database creation script"
```

---

### Task 2: Extract markdownToBlocks to Shared Module

**Files:**
- Create: `src/lib/notion-utils.ts`
- Modify: `src/lib/yt-notes/notion.ts` (replace local function with import)

- [ ] **Step 1: Create shared notion-utils.ts with enhanced markdownToBlocks**

```ts
// src/lib/notion-utils.ts
//
// Shared Notion API utilities.
// Converts Markdown text to Notion block children.

const NOTION_API = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";

/** Rich text segment with optional annotations */
function richText(text: string, annotations?: Record<string, boolean>) {
  const rt: Record<string, unknown> = { text: { content: text } };
  if (annotations) rt.annotations = annotations;
  return rt;
}

/** Parse inline markdown (**bold**, *italic*) into Notion rich_text array */
function parseInlineMarkdown(line: string): Array<Record<string, unknown>> {
  const segments: Array<Record<string, unknown>> = [];
  // Match **bold** and *italic* patterns
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|([^*]+))/g;
  let match;
  while ((match = regex.exec(line)) !== null) {
    if (match[2]) {
      // **bold**
      segments.push(richText(match[2], { bold: true }));
    } else if (match[3]) {
      // *italic*
      segments.push(richText(match[3], { italic: true }));
    } else if (match[4]) {
      segments.push(richText(match[4]));
    }
  }
  return segments.length > 0 ? segments : [richText(line)];
}

/** Convert markdown string into Notion block children.
 *  Supports: h1, h2, h3, bulleted list, numbered list, bold, italic, paragraph.
 *  Caps at 100 blocks (Notion API limit per request). */
export function markdownToBlocks(md: string): Array<Record<string, unknown>> {
  const blocks: Array<Record<string, unknown>> = [];
  const lines = md.split("\n");

  for (const line of lines) {
    if (!line.trim()) continue;

    // Heading 3
    const h3 = line.match(/^### (.+)/);
    if (h3) {
      blocks.push({
        object: "block",
        type: "heading_3",
        heading_3: { rich_text: [richText(h3[1])] },
      });
      continue;
    }

    // Heading 2
    const h2 = line.match(/^## (.+)/);
    if (h2) {
      blocks.push({
        object: "block",
        type: "heading_2",
        heading_2: { rich_text: [richText(h2[1])] },
      });
      continue;
    }

    // Heading 1
    const h1 = line.match(/^# (.+)/);
    if (h1) {
      blocks.push({
        object: "block",
        type: "heading_1",
        heading_1: { rich_text: [richText(h1[1])] },
      });
      continue;
    }

    // Bulleted list
    if (line.match(/^[-*] /)) {
      blocks.push({
        object: "block",
        type: "bulleted_list_item",
        bulleted_list_item: {
          rich_text: parseInlineMarkdown(line.replace(/^[-*] /, "")),
        },
      });
      continue;
    }

    // Numbered list
    const numbered = line.match(/^\d+\.\s+(.+)/);
    if (numbered) {
      blocks.push({
        object: "block",
        type: "numbered_list_item",
        numbered_list_item: {
          rich_text: parseInlineMarkdown(numbered[1]),
        },
      });
      continue;
    }

    // Paragraph (with inline formatting)
    blocks.push({
      object: "block",
      type: "paragraph",
      paragraph: { rich_text: parseInlineMarkdown(line) },
    });
  }

  return blocks.slice(0, 100);
}

/** Helper: make a Notion API request */
export async function notionFetch(
  path: string,
  options: { method?: string; body?: unknown } = {},
): Promise<Response> {
  const apiKey = process.env.NOTION_API_KEY;
  if (!apiKey) throw new Error("Missing NOTION_API_KEY");

  return fetch(`${NOTION_API}${path}`, {
    method: options.method ?? "GET",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json",
    },
    ...(options.body ? { body: JSON.stringify(options.body) } : {}),
  });
}
```

- [ ] **Step 2: Update yt-notes/notion.ts to use shared module**

Replace the local `markdownToBlocks` function in `src/lib/yt-notes/notion.ts` with an import:

```ts
// At the top of the file, add:
import { markdownToBlocks } from "@/lib/notion-utils";

// Then delete the entire local markdownToBlocks function (lines 74-120)
```

- [ ] **Step 3: Verify yt-notes still works**

```bash
# Quick compile check — no type errors
npx tsc --noEmit --pretty 2>&1 | head -20
```

Expected: No errors related to notion.ts or notion-utils.ts.

- [ ] **Step 4: Commit**

```bash
git add src/lib/notion-utils.ts src/lib/yt-notes/notion.ts
git commit -m "refactor: extract markdownToBlocks to shared notion-utils"
```

---

### Task 3: Social Prompt Templates

**Files:**
- Create: `src/lib/social/prompts.ts`

- [ ] **Step 1: Create prompt templates for each platform**

```ts
// src/lib/social/prompts.ts
//
// Prompt templates for social post generation.
// Each platform has distinct style requirements.

export type Platform = "fb" | "ig" | "line" | "school" | "notion";
export type Tone = "knowledge" | "casual" | "promotion";

const TONE_LABELS: Record<Tone, string> = {
  knowledge: "專業知識分享：語氣親切但有專業深度，適合教育工作者社群",
  casual: "輕鬆日常：像朋友聊天一樣自然，分享日常教學趣事",
  promotion: "活動宣傳：明確傳達活動資訊，吸引參與",
};

const PLATFORM_INSTRUCTIONS: Record<Platform, string> = {
  fb: `# Facebook 貼文
- 500-800 字
- 段落短（每段 2-3 行），方便手機閱讀
- 開頭用 hook 吸引注意（問句、驚嘆、場景描述）
- 結尾加 CTA（邀請留言、分享、提問）
- 適當使用 emoji（不過度，每段 0-1 個）
- 結尾附 3-5 個 hashtag`,

  ig: `# Instagram 貼文
- 300-500 字（精簡版）
- 短句為主，每句獨立一行
- 多用 emoji 營造視覺節奏
- 開頭直接切入重點
- 結尾用互動型 CTA（「你也有類似經驗嗎？」）
- 附 10-15 個 hashtag（含熱門+專業）`,

  line: `# LINE 訊息
- 200 字以內
- 重點條列（用 ✅ 或 • 符號）
- 直接說重點，不需要 hook
- 語氣簡潔親切
- 不用 hashtag`,

  school: `# 學校網站公告
- 正式語氣，符合學校公文風格
- 使用「本校」「茲」「敬請」等正式用語
- 結構：說明 → 內容 → 注意事項
- 不使用 emoji
- 不使用 hashtag`,

  notion: `# Notion 文章
- 完整文章格式，結構清晰
- 使用 Markdown：標題(##)、粗體(**text**)、條列(-)、編號(1.)
- 適合作為獨立分享的長文
- 內容深入，可包含背景說明和詳細步驟
- 不使用 hashtag（Notion 頁面不需要）`,
};

/** Build the system prompt for social post generation */
export function buildSocialPrompt(
  sourceText: string,
  platforms: Platform[],
  tone: Tone,
): string {
  const toneInstruction = TONE_LABELS[tone];
  const platformSections = platforms
    .map((p) => PLATFORM_INSTRUCTIONS[p])
    .join("\n\n---\n\n");

  return `<role>你是一位台灣特教教師的社群貼文助理。你的任務是將素材改寫成適合各社群平台的貼文。</role>

<tone>${toneInstruction}</tone>

<source>
${sourceText}
</source>

<task>
請根據上方素材，生成以下平台的貼文版本。每個平台的內容要**獨立撰寫**，不是複製貼上再微調，而是從該平台讀者的角度重新組織內容。

${platformSections}
</task>

<format>
以 JSON 格式回傳，不要加 markdown 圍欄：
{
${platforms.map((p) => `  "${p}": "該平台的完整貼文內容"`).join(",\n")}${platforms.length > 0 ? "," : ""}
  "hashtags": "所有 hashtag 空格分隔（適用於有 hashtag 的平台）"
}

重要：
- JSON 字串中的換行用 \\n 表示
- 不要在 JSON 外面加任何文字或 markdown 圍欄
- 使用繁體中文
</format>`;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/social/prompts.ts
git commit -m "feat(social): add per-platform prompt templates"
```

---

### Task 4: Social Zustand Store

**Files:**
- Create: `src/stores/social-store.ts`

- [ ] **Step 1: Create the social store**

```ts
// src/stores/social-store.ts
import { create } from "zustand";
import type { Platform, Tone } from "@/lib/social/prompts";

export interface UploadedImage {
  id: string;
  file: File;
  previewUrl: string; // Object URL for local preview
  uploadedUrl?: string; // Server URL after upload
}

export interface GeneratedContents {
  fb?: string;
  ig?: string;
  line?: string;
  school?: string;
  notion?: string;
  hashtags?: string;
}

export interface HistoryPost {
  id: string;
  title: string;
  platforms: string[];
  published: string[];
  status: string;
  date: string | null;
  notionUrl: string;
}

interface SocialState {
  // Source input
  sourceText: string;
  sourceLabel: string; // "direct" or Obsidian note title

  // Images
  images: UploadedImage[];

  // Settings
  platforms: Platform[];
  tone: Tone;

  // Generation
  isGenerating: boolean;
  generatedContents: GeneratedContents | null;
  activePreviewTab: Platform | null;

  // Publish
  isPublishing: boolean;
  lastPublishedUrl: string | null;

  // History
  history: HistoryPost[];

  // Error
  error: string | null;

  // Actions
  setSourceText: (text: string, label?: string) => void;
  addImages: (files: File[]) => void;
  removeImage: (id: string) => void;
  setImageUploadedUrl: (id: string, url: string) => void;
  togglePlatform: (platform: Platform) => void;
  setTone: (tone: Tone) => void;
  setGenerating: (v: boolean) => void;
  setGeneratedContents: (contents: GeneratedContents | null) => void;
  updateGeneratedContent: (platform: Platform, text: string) => void;
  setActivePreviewTab: (tab: Platform | null) => void;
  setPublishing: (v: boolean) => void;
  setLastPublishedUrl: (url: string | null) => void;
  setHistory: (posts: HistoryPost[]) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

const INITIAL_STATE = {
  sourceText: "",
  sourceLabel: "direct",
  images: [] as UploadedImage[],
  platforms: ["fb" as Platform],
  tone: "knowledge" as Tone,
  isGenerating: false,
  generatedContents: null as GeneratedContents | null,
  activePreviewTab: null as Platform | null,
  isPublishing: false,
  lastPublishedUrl: null as string | null,
  history: [] as HistoryPost[],
  error: null as string | null,
};

export const useSocialStore = create<SocialState>((set) => ({
  ...INITIAL_STATE,

  setSourceText: (text, label) =>
    set({ sourceText: text, sourceLabel: label ?? "direct" }),

  addImages: (files) =>
    set((s) => ({
      images: [
        ...s.images,
        ...files.map((file) => ({
          id: crypto.randomUUID().slice(0, 8),
          file,
          previewUrl: URL.createObjectURL(file),
        })),
      ],
    })),

  removeImage: (id) =>
    set((s) => {
      const img = s.images.find((i) => i.id === id);
      if (img) URL.revokeObjectURL(img.previewUrl);
      return { images: s.images.filter((i) => i.id !== id) };
    }),

  setImageUploadedUrl: (id, url) =>
    set((s) => ({
      images: s.images.map((i) => (i.id === id ? { ...i, uploadedUrl: url } : i)),
    })),

  togglePlatform: (platform) =>
    set((s) => {
      const has = s.platforms.includes(platform);
      const next = has
        ? s.platforms.filter((p) => p !== platform)
        : [...s.platforms, platform];
      return { platforms: next.length > 0 ? next : s.platforms };
    }),

  setTone: (tone) => set({ tone }),
  setGenerating: (v) => set({ isGenerating: v }),
  setGeneratedContents: (contents) =>
    set({
      generatedContents: contents,
      activePreviewTab: contents ? Object.keys(contents).find((k) => k !== "hashtags") as Platform ?? null : null,
    }),
  updateGeneratedContent: (platform, text) =>
    set((s) => ({
      generatedContents: s.generatedContents
        ? { ...s.generatedContents, [platform]: text }
        : null,
    })),
  setActivePreviewTab: (tab) => set({ activePreviewTab: tab }),
  setPublishing: (v) => set({ isPublishing: v }),
  setLastPublishedUrl: (url) => set({ lastPublishedUrl: url }),
  setHistory: (posts) => set({ history: posts }),
  setError: (error) => set({ error }),

  reset: () =>
    set((s) => {
      for (const img of s.images) URL.revokeObjectURL(img.previewUrl);
      return { ...INITIAL_STATE };
    }),
}));
```

- [ ] **Step 2: Commit**

```bash
git add src/stores/social-store.ts
git commit -m "feat(social): add Zustand store for social workstation"
```

---

### Task 5: API — Upload Image

**Files:**
- Create: `src/app/api/social/upload-image/route.ts`

- [ ] **Step 1: Create the upload route**

```ts
// src/app/api/social/upload-image/route.ts
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const files = formData.getAll("images") as File[];

    if (files.length === 0) {
      return Response.json({ error: "No images provided" }, { status: 400 });
    }

    const today = new Date().toISOString().slice(0, 10);
    const dir = join(process.cwd(), "public", "uploads", "social", today);
    await mkdir(dir, { recursive: true });

    const urls: string[] = [];

    for (const file of files) {
      const ext = file.name.split(".").pop() || "jpg";
      const name = `${crypto.randomUUID().slice(0, 8)}.${ext}`;
      const buffer = Buffer.from(await file.arrayBuffer());
      const filePath = join(dir, name);
      await writeFile(filePath, buffer);
      urls.push(`/uploads/social/${today}/${name}`);
    }

    return Response.json({ urls });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ error: msg }, { status: 500 });
  }
}
```

- [ ] **Step 2: Verify by running the dev server and testing with curl**

```bash
# Start dev server if not running, then test:
echo "test" > /tmp/test.jpg
curl -s -X POST http://localhost:3000/api/social/upload-image \
  -F "images=@/tmp/test.jpg" | jq .
```

Expected: `{ "urls": ["/uploads/social/2026-04-07/xxxxxxxx.jpg"] }`

- [ ] **Step 3: Commit**

```bash
git add src/app/api/social/upload-image/route.ts
git commit -m "feat(social): add image upload API route"
```

---

### Task 6: API — Generate (LLM Streaming)

**Files:**
- Create: `src/app/api/social/generate/route.ts`

- [ ] **Step 1: Create the streaming generation route**

```ts
// src/app/api/social/generate/route.ts
import { getLLMProvider } from "@/lib/llm-provider";
import { buildSocialPrompt, type Platform, type Tone } from "@/lib/social/prompts";
import { cleanClaudeOutput, fixJsonControlChars } from "@/lib/documents-utils";
import type { AgentCliProvider } from "@/types/chat";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface GenerateBody {
  text: string;
  platforms: Platform[];
  tone: Tone;
  provider?: AgentCliProvider;
  model?: string;
}

export async function POST(request: Request) {
  const { text, platforms, tone, provider: reqProvider, model } =
    (await request.json()) as GenerateBody;

  if (!text?.trim()) {
    return Response.json({ error: "Missing text" }, { status: 400 });
  }
  if (!platforms?.length) {
    return Response.json({ error: "No platforms selected" }, { status: 400 });
  }

  const prompt = buildSocialPrompt(text, platforms, tone);
  const llm = getLLMProvider(reqProvider);

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (event: string, data: unknown) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
        );
      };

      let accumulated = "";

      try {
        for await (const event of llm.stream({
          prompt,
          model,
          stdinPrompt: true,
          noMcp: true,
          noVault: true,
        })) {
          switch (event.type) {
            case "text":
              accumulated += event.text!;
              send("text", { text: event.text });
              break;
            case "error":
              send("error", { message: event.error });
              break;
          }
        }
      } catch (e) {
        send("error", { message: `Stream error: ${e}` });
      }

      // Parse the accumulated JSON
      if (accumulated) {
        try {
          const cleaned = fixJsonControlChars(cleanClaudeOutput(accumulated)).trim();

          const tryParse = (t: string) => {
            try { return JSON.parse(t); } catch { return null; }
          };

          let parsed = tryParse(cleaned);

          // Strip markdown fences if present
          if (!parsed) {
            const stripped = cleaned
              .replace(/^```(?:json)?\s*\n?/m, "")
              .replace(/\n?```\s*$/m, "")
              .trim();
            parsed = tryParse(stripped);
          }

          if (parsed) {
            send("result", parsed);
          } else {
            send("error", {
              message: `Failed to parse LLM response as JSON. Raw: ${cleaned.substring(0, 200)}...`,
            });
          }
        } catch (e) {
          send("error", { message: `Parse error: ${e}` });
        }
      }

      send("done", {});
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
```

- [ ] **Step 2: Verify compile**

```bash
npx tsc --noEmit --pretty 2>&1 | grep -i "social"
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/social/generate/route.ts
git commit -m "feat(social): add LLM streaming generation API route"
```

---

### Task 7: Social Notion API + Publish Route

**Files:**
- Create: `src/lib/social/notion.ts`
- Create: `src/app/api/social/publish-notion/route.ts`

- [ ] **Step 1: Create social Notion library**

```ts
// src/lib/social/notion.ts
import { markdownToBlocks, notionFetch } from "@/lib/notion-utils";
import type { Platform } from "./prompts";

const PLATFORM_LABELS: Record<Platform, string> = {
  fb: "Facebook",
  ig: "Instagram",
  line: "LINE",
  school: "學校網站",
  notion: "Notion",
};

export interface CreateSocialPostParams {
  title: string;
  platforms: Platform[];
  contents: Partial<Record<Platform, string>>;
  hashtags?: string;
  imageUrls?: string[];
  publishDate?: string;
  tags?: string[];
  tone?: string;
  source?: string;
}

/** Create a social post page in the Notion database */
export async function createSocialPost(
  params: CreateSocialPostParams,
): Promise<{ notionUrl: string; pageId: string }> {
  const databaseId = process.env.NOTION_SOCIAL_DATABASE_ID;
  if (!databaseId) throw new Error("Missing NOTION_SOCIAL_DATABASE_ID");

  const { title, platforms, contents, hashtags, imageUrls, publishDate, tags, tone, source } = params;

  // Build rich_text helper (Notion limits to 2000 chars per rich_text element)
  const rt = (text?: string) =>
    text ? [{ text: { content: text.slice(0, 2000) } }] : [];

  // Build properties
  const properties: Record<string, unknown> = {
    Title: { title: [{ text: { content: title } }] },
    Status: { status: { name: "草稿" } },
    Platforms: {
      multi_select: platforms.map((p) => ({ name: PLATFORM_LABELS[p] })),
    },
  };

  if (publishDate) {
    properties["Publish Date"] = { date: { start: publishDate } };
  }
  if (tags?.length) {
    properties.Tags = { multi_select: tags.map((t) => ({ name: t })) };
  }
  if (tone) {
    properties.Tone = { select: { name: tone } };
  }
  if (source) {
    properties.Source = { rich_text: rt(source) };
  }
  if (contents.fb) {
    properties["Content FB"] = { rich_text: rt(contents.fb) };
  }
  if (contents.ig) {
    properties["Content IG"] = { rich_text: rt(contents.ig) };
  }
  if (contents.line) {
    properties["Content LINE"] = { rich_text: rt(contents.line) };
  }
  if (contents.school) {
    properties["Content School"] = { rich_text: rt(contents.school) };
  }
  if (hashtags) {
    properties.Hashtags = { rich_text: rt(hashtags) };
  }
  if (imageUrls?.length) {
    properties["Image URLs"] = { rich_text: rt(imageUrls.join(",")) };
  }

  // Build page body: if Notion platform is selected, render as article
  // Otherwise, show all platform versions separated by headings
  const bodyMarkdown = buildPageBody(platforms, contents, hashtags);
  const children = markdownToBlocks(bodyMarkdown);

  const res = await notionFetch("/pages", {
    method: "POST",
    body: {
      parent: { database_id: databaseId },
      properties,
      children,
    },
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Notion API error ${res.status}: ${err}`);
  }

  const data = await res.json();
  return { notionUrl: data.url, pageId: data.id };
}

/** Build the page body markdown from generated contents */
function buildPageBody(
  platforms: Platform[],
  contents: Partial<Record<Platform, string>>,
  hashtags?: string,
): string {
  const sections: string[] = [];

  // If Notion is a target platform, its content is the main body
  if (platforms.includes("notion") && contents.notion) {
    sections.push(contents.notion);
    // Add other platforms as appendix
    const others = platforms.filter((p) => p !== "notion");
    if (others.length > 0) {
      sections.push("\n---\n\n## 各平台版本");
      for (const p of others) {
        if (contents[p]) {
          sections.push(`\n### ${PLATFORM_LABELS[p]}\n\n${contents[p]}`);
        }
      }
    }
  } else {
    // No Notion target — list all platform versions
    for (const p of platforms) {
      if (contents[p]) {
        sections.push(`## ${PLATFORM_LABELS[p]}\n\n${contents[p]}`);
      }
    }
  }

  if (hashtags) {
    sections.push(`\n---\n\n**Hashtags:** ${hashtags}`);
  }

  return sections.join("\n\n");
}

/** Fetch recent posts from the social database */
export async function fetchSocialHistory(limit = 20): Promise<Array<Record<string, unknown>>> {
  const databaseId = process.env.NOTION_SOCIAL_DATABASE_ID;
  if (!databaseId) throw new Error("Missing NOTION_SOCIAL_DATABASE_ID");

  const res = await notionFetch(`/databases/${databaseId}/query`, {
    method: "POST",
    body: {
      sorts: [{ timestamp: "created_time", direction: "descending" }],
      page_size: limit,
    },
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Notion API error ${res.status}: ${err}`);
  }

  const data = await res.json();

  return data.results.map((page: Record<string, unknown>) => {
    const props = page.properties as Record<string, Record<string, unknown>>;
    const titleProp = props.Title as { title: Array<{ plain_text: string }> };
    const statusProp = props.Status as { status: { name: string } | null };
    const platformsProp = props.Platforms as { multi_select: Array<{ name: string }> };
    const publishedProp = props.Published as { multi_select: Array<{ name: string }> };
    const dateProp = props["Publish Date"] as { date: { start: string } | null };

    return {
      id: page.id,
      title: titleProp?.title?.[0]?.plain_text ?? "Untitled",
      platforms: platformsProp?.multi_select?.map((s: { name: string }) => s.name) ?? [],
      published: publishedProp?.multi_select?.map((s: { name: string }) => s.name) ?? [],
      status: statusProp?.status?.name ?? "草稿",
      date: dateProp?.date?.start ?? null,
      notionUrl: (page as { url?: string }).url ?? "",
    };
  });
}
```

- [ ] **Step 2: Create the publish-notion route**

```ts
// src/app/api/social/publish-notion/route.ts
import { createSocialPost, type CreateSocialPostParams } from "@/lib/social/notion";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CreateSocialPostParams;

    if (!body.title?.trim()) {
      return Response.json({ error: "Missing title" }, { status: 400 });
    }
    if (!body.platforms?.length) {
      return Response.json({ error: "No platforms selected" }, { status: 400 });
    }

    const result = await createSocialPost(body);
    return Response.json(result);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ error: msg }, { status: 500 });
  }
}
```

- [ ] **Step 3: Create the history route**

```ts
// src/app/api/social/history/route.ts
import { fetchSocialHistory } from "@/lib/social/notion";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const posts = await fetchSocialHistory();
    return Response.json({ posts });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ error: msg }, { status: 500 });
  }
}
```

- [ ] **Step 4: Verify compile**

```bash
npx tsc --noEmit --pretty 2>&1 | grep -i "social\|notion-utils"
```

Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/social/notion.ts src/app/api/social/publish-notion/route.ts src/app/api/social/history/route.ts
git commit -m "feat(social): add Notion publish + history API routes"
```

---

### Task 8: UI — SourceInput Component

**Files:**
- Create: `src/components/skills/workstations/social/source-input.tsx`

- [ ] **Step 1: Create SourceInput with direct text and QMD search**

```tsx
// src/components/skills/workstations/social/source-input.tsx
"use client";

import { useState, useCallback } from "react";
import { Search } from "lucide-react";
import { useSocialStore } from "@/stores/social-store";

type InputMode = "direct" | "qmd";

export function SourceInput() {
  const { sourceText, sourceLabel, setSourceText } = useSocialStore();
  const [mode, setMode] = useState<InputMode>("direct");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<
    Array<{ title: string; snippet: string; file: string }>
  >([]);
  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    try {
      // Use the QMD MCP search endpoint via a proxy API
      const res = await fetch("/api/social/qmd-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: searchQuery }),
      });
      const data = await res.json();
      setSearchResults(data.results ?? []);
    } catch {
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [searchQuery]);

  const handleSelectResult = useCallback(
    async (file: string, title: string) => {
      try {
        const res = await fetch("/api/social/qmd-search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ file }),
        });
        const data = await res.json();
        if (data.content) {
          setSourceText(data.content, title);
          setMode("direct"); // Switch to show the loaded text
        }
      } catch {
        // Ignore
      }
    },
    [setSourceText],
  );

  return (
    <div className="space-y-2">
      <label className="text-xs font-medium text-cy-muted">文字來源</label>

      {/* Mode toggle */}
      <div className="flex gap-1 rounded-md bg-cy-bg p-0.5">
        <button
          onClick={() => setMode("direct")}
          className={`flex-1 rounded px-2 py-1 text-xs transition-colors ${
            mode === "direct"
              ? "bg-cy-card text-cy-text shadow-sm"
              : "text-cy-muted hover:text-cy-text"
          }`}
        >
          直接輸入
        </button>
        <button
          onClick={() => setMode("qmd")}
          className={`flex-1 rounded px-2 py-1 text-xs transition-colors ${
            mode === "qmd"
              ? "bg-cy-card text-cy-text shadow-sm"
              : "text-cy-muted hover:text-cy-text"
          }`}
        >
          搜尋筆記
        </button>
      </div>

      {mode === "direct" ? (
        <div>
          {sourceLabel !== "direct" && (
            <div className="mb-1 text-xs text-cy-accent">
              來源：{sourceLabel}
            </div>
          )}
          <textarea
            value={sourceText}
            onChange={(e) => setSourceText(e.target.value)}
            placeholder="貼上你想分享的內容..."
            className="h-40 w-full resize-none rounded-md border border-cy-border bg-cy-input p-2 text-sm text-cy-text placeholder:text-cy-muted/50 focus:border-cy-accent focus:outline-none"
          />
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex gap-1">
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="搜尋 Obsidian 筆記..."
              className="flex-1 rounded-md border border-cy-border bg-cy-input px-2 py-1.5 text-sm text-cy-text placeholder:text-cy-muted/50 focus:border-cy-accent focus:outline-none"
            />
            <button
              onClick={handleSearch}
              disabled={isSearching}
              className="rounded-md bg-cy-accent px-2 py-1.5 text-xs text-white hover:bg-cy-accent/90 disabled:opacity-50"
            >
              <Search className="h-3.5 w-3.5" />
            </button>
          </div>

          {isSearching && (
            <p className="text-xs text-cy-muted">搜尋中...</p>
          )}

          {searchResults.length > 0 && (
            <div className="max-h-48 space-y-1 overflow-y-auto">
              {searchResults.map((r, i) => (
                <button
                  key={i}
                  onClick={() => handleSelectResult(r.file, r.title)}
                  className="w-full rounded-md border border-cy-border bg-cy-card p-2 text-left transition-colors hover:border-cy-accent"
                >
                  <p className="text-xs font-medium text-cy-text">
                    {r.title}
                  </p>
                  <p className="mt-0.5 line-clamp-2 text-xs text-cy-muted">
                    {r.snippet}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create the QMD search proxy API route**

This route proxies QMD search from the browser since QMD MCP runs server-side.

```ts
// src/app/api/social/qmd-search/route.ts
import { readFile } from "fs/promises";
import { PATHS } from "@/config/paths-config";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json();

  // Mode 1: Search — returns results
  if (body.query) {
    try {
      // Use QMD CLI for search (simpler than MCP protocol)
      const { execSync } = await import("child_process");
      const raw = execSync(
        `qmd search ${JSON.stringify(body.query)} --limit 10 --json`,
        { encoding: "utf-8", timeout: 10000 },
      );
      const results = JSON.parse(raw);
      return Response.json({
        results: results.map((r: Record<string, string>) => ({
          title: r.title || r.file,
          snippet: r.snippet || "",
          file: r.file,
          collection: r.collection,
        })),
      });
    } catch (e) {
      return Response.json({ results: [], error: String(e) });
    }
  }

  // Mode 2: Get file content — returns full text
  if (body.file) {
    try {
      const { execSync } = await import("child_process");
      const raw = execSync(
        `qmd get ${JSON.stringify(body.file)}`,
        { encoding: "utf-8", timeout: 10000 },
      );
      return Response.json({ content: raw });
    } catch (e) {
      return Response.json({ content: null, error: String(e) });
    }
  }

  return Response.json({ error: "Missing query or file" }, { status: 400 });
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/skills/workstations/social/source-input.tsx src/app/api/social/qmd-search/route.ts
git commit -m "feat(social): add SourceInput component with QMD search"
```

---

### Task 9: UI — ImageUploader Component

**Files:**
- Create: `src/components/skills/workstations/social/image-uploader.tsx`

- [ ] **Step 1: Create ImageUploader with drag-and-drop**

```tsx
// src/components/skills/workstations/social/image-uploader.tsx
"use client";

import { useCallback, useRef } from "react";
import { ImagePlus, X } from "lucide-react";
import { useSocialStore } from "@/stores/social-store";

export function ImageUploader() {
  const { images, addImages, removeImage } = useSocialStore();
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files) return;
      const imageFiles = Array.from(files).filter((f) =>
        f.type.startsWith("image/"),
      );
      if (imageFiles.length > 0) addImages(imageFiles);
    },
    [addImages],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles],
  );

  return (
    <div className="space-y-2">
      <label className="text-xs font-medium text-cy-muted">附圖（可選）</label>

      {/* Drop zone */}
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className="flex cursor-pointer items-center justify-center rounded-md border border-dashed border-cy-border bg-cy-input/30 p-3 transition-colors hover:border-cy-accent hover:bg-cy-input/50"
      >
        <div className="flex items-center gap-2 text-xs text-cy-muted">
          <ImagePlus className="h-4 w-4" />
          <span>拖曳或點擊上傳圖片</span>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => handleFiles(e.target.files)}
          className="hidden"
        />
      </div>

      {/* Thumbnails */}
      {images.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {images.map((img) => (
            <div key={img.id} className="group relative">
              <img
                src={img.previewUrl}
                alt=""
                className="h-16 w-16 rounded-md border border-cy-border object-cover"
              />
              <button
                onClick={() => removeImage(img.id)}
                className="absolute -right-1 -top-1 hidden rounded-full bg-cy-error p-0.5 text-white group-hover:block"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/skills/workstations/social/image-uploader.tsx
git commit -m "feat(social): add ImageUploader with drag-and-drop"
```

---

### Task 10: UI — PlatformSelector Component

**Files:**
- Create: `src/components/skills/workstations/social/platform-selector.tsx`

- [ ] **Step 1: Create PlatformSelector**

```tsx
// src/components/skills/workstations/social/platform-selector.tsx
"use client";

import { useSocialStore } from "@/stores/social-store";
import type { Platform, Tone } from "@/lib/social/prompts";

const PLATFORMS: Array<{ id: Platform; label: string; icon: string }> = [
  { id: "fb", label: "Facebook", icon: "📘" },
  { id: "ig", label: "Instagram", icon: "📸" },
  { id: "line", label: "LINE", icon: "💬" },
  { id: "school", label: "學校網站", icon: "🏫" },
  { id: "notion", label: "Notion", icon: "📝" },
];

const TONES: Array<{ id: Tone; label: string }> = [
  { id: "knowledge", label: "知識分享" },
  { id: "casual", label: "日常" },
  { id: "promotion", label: "活動宣傳" },
];

interface PlatformSelectorProps {
  onGenerate: () => void;
  disabled?: boolean;
}

export function PlatformSelector({ onGenerate, disabled }: PlatformSelectorProps) {
  const { platforms, tone, togglePlatform, setTone, sourceText, isGenerating } =
    useSocialStore();

  return (
    <div className="space-y-3">
      {/* Platform checkboxes */}
      <div>
        <label className="text-xs font-medium text-cy-muted">目標平台</label>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {PLATFORMS.map((p) => {
            const active = platforms.includes(p.id);
            return (
              <button
                key={p.id}
                onClick={() => togglePlatform(p.id)}
                className={`rounded-md border px-2 py-1 text-xs transition-colors ${
                  active
                    ? "border-cy-accent bg-cy-accent/10 text-cy-accent"
                    : "border-cy-border text-cy-muted hover:border-cy-accent/50"
                }`}
              >
                {p.icon} {p.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tone selector */}
      <div>
        <label className="text-xs font-medium text-cy-muted">語氣</label>
        <div className="mt-1 flex gap-1.5">
          {TONES.map((t) => (
            <button
              key={t.id}
              onClick={() => setTone(t.id)}
              className={`rounded-md border px-2 py-1 text-xs transition-colors ${
                tone === t.id
                  ? "border-cy-accent bg-cy-accent/10 text-cy-accent"
                  : "border-cy-border text-cy-muted hover:border-cy-accent/50"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Generate button */}
      <button
        onClick={onGenerate}
        disabled={disabled || isGenerating || !sourceText.trim()}
        className="w-full rounded-md bg-cy-accent py-2 text-sm font-medium text-white transition-colors hover:bg-cy-accent/90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isGenerating ? "生成中..." : "✨ 生成貼文"}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/skills/workstations/social/platform-selector.tsx
git commit -m "feat(social): add PlatformSelector component"
```

---

### Task 11: UI — PlatformPreview Component

**Files:**
- Create: `src/components/skills/workstations/social/platform-preview.tsx`

- [ ] **Step 1: Create PlatformPreview with tabs and copy/publish**

```tsx
// src/components/skills/workstations/social/platform-preview.tsx
"use client";

import { useCallback, useState } from "react";
import { Copy, Check, ExternalLink } from "lucide-react";
import { useSocialStore } from "@/stores/social-store";
import type { Platform } from "@/lib/social/prompts";

const PLATFORM_LABELS: Record<Platform, string> = {
  fb: "FB",
  ig: "IG",
  line: "LINE",
  school: "學校",
  notion: "Notion",
};

export function PlatformPreview() {
  const {
    generatedContents,
    activePreviewTab,
    setActivePreviewTab,
    platforms,
    images,
    isPublishing,
    setPublishing,
    setLastPublishedUrl,
    setError,
    updateGeneratedContent,
    sourceLabel,
  } = useSocialStore();

  const [copiedPlatform, setCopiedPlatform] = useState<string | null>(null);

  const handleCopy = useCallback(
    async (platform: Platform) => {
      const text = generatedContents?.[platform];
      if (!text) return;

      // Append hashtags for platforms that use them
      const hashtags = generatedContents?.hashtags;
      const withHashtags =
        hashtags && ["fb", "ig"].includes(platform)
          ? `${text}\n\n${hashtags}`
          : text;

      await navigator.clipboard.writeText(withHashtags);
      setCopiedPlatform(platform);
      setTimeout(() => setCopiedPlatform(null), 2000);
    },
    [generatedContents],
  );

  const handlePublishNotion = useCallback(async () => {
    if (!generatedContents) return;
    setPublishing(true);
    setError(null);

    try {
      // Upload images first
      const imageUrls: string[] = [];
      const unuploaded = images.filter((img) => !img.uploadedUrl);
      if (unuploaded.length > 0) {
        const formData = new FormData();
        for (const img of unuploaded) {
          formData.append("images", img.file);
        }
        const uploadRes = await fetch("/api/social/upload-image", {
          method: "POST",
          body: formData,
        });
        const uploadData = await uploadRes.json();
        if (uploadData.urls) {
          imageUrls.push(...uploadData.urls);
        }
      }
      // Include already-uploaded URLs
      for (const img of images) {
        if (img.uploadedUrl) imageUrls.push(img.uploadedUrl);
      }

      // Create the first ~30 chars as title
      const firstContent = Object.values(generatedContents).find(
        (v) => typeof v === "string" && v.length > 0,
      ) as string | undefined;
      const title =
        firstContent?.replace(/\n/g, " ").slice(0, 40).trim() || "社群貼文";

      const res = await fetch("/api/social/publish-notion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          platforms,
          contents: generatedContents,
          hashtags: generatedContents.hashtags,
          imageUrls,
          publishDate: new Date().toISOString().slice(0, 10),
          source: sourceLabel !== "direct" ? sourceLabel : undefined,
        }),
      });

      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setLastPublishedUrl(data.notionUrl);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Publish failed");
    } finally {
      setPublishing(false);
    }
  }, [generatedContents, platforms, images, sourceLabel, setPublishing, setError, setLastPublishedUrl]);

  const { lastPublishedUrl } = useSocialStore();

  if (!generatedContents) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-cy-muted">
        在左側輸入素材並點擊「生成貼文」
      </div>
    );
  }

  const activePlatforms = platforms.filter((p) => generatedContents[p]);

  return (
    <div className="flex h-full flex-col">
      {/* Platform tabs */}
      <div className="flex border-b border-cy-border">
        {activePlatforms.map((p) => (
          <button
            key={p}
            onClick={() => setActivePreviewTab(p)}
            className={`px-3 py-2 text-xs font-medium transition-colors ${
              activePreviewTab === p
                ? "border-b-2 border-cy-accent text-cy-accent"
                : "text-cy-muted hover:text-cy-text"
            }`}
          >
            {PLATFORM_LABELS[p]}
          </button>
        ))}
      </div>

      {/* Content preview */}
      {activePreviewTab && generatedContents[activePreviewTab] && (
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-3">
            <textarea
              value={generatedContents[activePreviewTab] ?? ""}
              onChange={(e) => updateGeneratedContent(activePreviewTab, e.target.value)}
              className="h-full w-full resize-none bg-transparent text-sm text-cy-text focus:outline-none"
            />
          </div>

          {/* Hashtags */}
          {generatedContents.hashtags && ["fb", "ig"].includes(activePreviewTab) && (
            <div className="border-t border-cy-border px-3 py-2">
              <p className="text-xs text-cy-accent">
                {generatedContents.hashtags}
              </p>
            </div>
          )}

          {/* Image thumbnails */}
          {images.length > 0 && (
            <div className="flex gap-2 border-t border-cy-border px-3 py-2">
              {images.map((img) => (
                <img
                  key={img.id}
                  src={img.previewUrl}
                  alt=""
                  className="h-12 w-12 rounded border border-cy-border object-cover"
                />
              ))}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center gap-2 border-t border-cy-border p-3">
            <button
              onClick={() => handleCopy(activePreviewTab)}
              className="flex items-center gap-1.5 rounded-md border border-cy-border px-3 py-1.5 text-xs text-cy-text transition-colors hover:bg-cy-input/50"
            >
              {copiedPlatform === activePreviewTab ? (
                <>
                  <Check className="h-3.5 w-3.5 text-green-500" />
                  已複製
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  複製文字
                </>
              )}
            </button>

            <button
              onClick={handlePublishNotion}
              disabled={isPublishing}
              className="flex items-center gap-1.5 rounded-md bg-cy-accent px-3 py-1.5 text-xs text-white transition-colors hover:bg-cy-accent/90 disabled:opacity-50"
            >
              {isPublishing ? "發布中..." : "📝 存到 Notion"}
            </button>

            {lastPublishedUrl && (
              <a
                href={lastPublishedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-cy-accent hover:underline"
              >
                <ExternalLink className="h-3 w-3" />
                開啟 Notion
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/skills/workstations/social/platform-preview.tsx
git commit -m "feat(social): add PlatformPreview with tabs, edit, copy, publish"
```

---

### Task 12: UI — PostHistory Component

**Files:**
- Create: `src/components/skills/workstations/social/post-history.tsx`

- [ ] **Step 1: Create PostHistory**

```tsx
// src/components/skills/workstations/social/post-history.tsx
"use client";

import { useEffect, useCallback } from "react";
import { ExternalLink, RefreshCw } from "lucide-react";
import { useSocialStore } from "@/stores/social-store";

export function PostHistory() {
  const { history, setHistory } = useSocialStore();

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch("/api/social/history");
      const data = await res.json();
      if (data.posts) setHistory(data.posts);
    } catch {
      // Ignore
    }
  }, [setHistory]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const statusColor: Record<string, string> = {
    "草稿": "text-cy-muted",
    "待發布": "text-yellow-500",
    "已發布": "text-green-500",
    "失敗": "text-red-500",
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-cy-muted">歷史記錄</label>
        <button
          onClick={fetchHistory}
          className="text-cy-muted hover:text-cy-text transition-colors"
        >
          <RefreshCw className="h-3 w-3" />
        </button>
      </div>

      {history.length === 0 ? (
        <p className="text-xs text-cy-muted/50">尚無發文記錄</p>
      ) : (
        <div className="max-h-48 space-y-1 overflow-y-auto">
          {history.map((post) => (
            <a
              key={post.id}
              href={post.notionUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-md border border-cy-border p-2 transition-colors hover:border-cy-accent"
            >
              <div className="flex-1 min-w-0">
                <p className="truncate text-xs font-medium text-cy-text">
                  {post.title}
                </p>
                <div className="mt-0.5 flex items-center gap-1.5 text-[10px]">
                  <span className={statusColor[post.status] ?? "text-cy-muted"}>
                    {post.status}
                  </span>
                  {post.date && (
                    <span className="text-cy-muted">{post.date}</span>
                  )}
                  <span className="text-cy-muted">
                    {post.platforms.join("・")}
                  </span>
                </div>
              </div>
              <ExternalLink className="h-3 w-3 shrink-0 text-cy-muted" />
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/skills/workstations/social/post-history.tsx
git commit -m "feat(social): add PostHistory component"
```

---

### Task 13: UI — SocialWorkstation Main Container

**Files:**
- Create: `src/components/skills/workstations/social/social-workstation.tsx`

- [ ] **Step 1: Create the main workstation container**

```tsx
// src/components/skills/workstations/social/social-workstation.tsx
"use client";

import { useCallback, useRef, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useAppStore } from "@/stores/app-store";
import { useAgentStore } from "@/stores/agent-store";
import { useSocialStore } from "@/stores/social-store";
import { SourceInput } from "./source-input";
import { ImageUploader } from "./image-uploader";
import { PlatformSelector } from "./platform-selector";
import { PlatformPreview } from "./platform-preview";
import { PostHistory } from "./post-history";
import { WorkstationLLMControls } from "../shared/workstation-llm-controls";

export function SocialWorkstation() {
  const { setActiveWorkstation } = useAppStore();
  const { provider, model } = useAgentStore();
  const {
    sourceText,
    platforms,
    tone,
    isGenerating,
    setGenerating,
    setGeneratedContents,
    setError,
    error,
  } = useSocialStore();

  // Resizable left panel
  const [leftWidth, setLeftWidth] = useState(340);
  const isDragging = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const handleMouseMove = (ev: MouseEvent) => {
      if (!isDragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const newWidth = Math.max(280, Math.min(ev.clientX - rect.left, rect.width * 0.5));
      setLeftWidth(newWidth);
    };

    const handleMouseUp = () => {
      isDragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!sourceText.trim() || platforms.length === 0) return;

    setGenerating(true);
    setError(null);
    setGeneratedContents(null);

    try {
      const res = await fetch("/api/social/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: sourceText,
          platforms,
          tone,
          provider,
          model,
        }),
      });

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response stream");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (line.startsWith("event: result")) {
            // Next line is the data
            continue;
          }
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              // Check if this is the result event
              if (data.fb || data.ig || data.line || data.school || data.notion) {
                setGeneratedContents(data);
              }
              if (data.message) {
                setError(data.message);
              }
            } catch {
              // Partial JSON, ignore
            }
          }
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  }, [sourceText, platforms, tone, provider, model, setGenerating, setError, setGeneratedContents]);

  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 5.5rem)" }}>
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-cy-border pb-3">
        <button
          onClick={() => setActiveWorkstation(null)}
          className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-cy-muted hover:bg-cy-input/50 hover:text-cy-text transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Skills
        </button>
        <span className="text-lg">📱</span>
        <h1 className="text-lg font-bold text-cy-text">社群發文模組</h1>
        <WorkstationLLMControls />
        {error && (
          <span className="rounded bg-cy-error/20 px-2 py-0.5 text-xs text-cy-error">
            {error}
          </span>
        )}
      </div>

      {/* Main content: resizable left/right split */}
      <div ref={containerRef} className="flex flex-1 overflow-hidden mt-3" style={{ minHeight: 0 }}>
        {/* Left: Input panel */}
        <div className="shrink-0 space-y-4 overflow-y-auto pr-2" style={{ width: leftWidth }}>
          <SourceInput />
          <ImageUploader />
          <PlatformSelector onGenerate={handleGenerate} />
          <PostHistory />
        </div>

        {/* Resize handle */}
        <div
          onMouseDown={handleMouseDown}
          className="group flex w-2 shrink-0 cursor-col-resize items-center justify-center hover:bg-cy-accent/10 transition-colors"
        >
          <div className="h-8 w-0.5 rounded-full bg-cy-muted/20 group-hover:bg-cy-accent/50 transition-colors" />
        </div>

        {/* Right: Preview */}
        <div className="flex-1 overflow-hidden rounded-md border border-cy-border" style={{ minWidth: 0 }}>
          <PlatformPreview />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/skills/workstations/social/social-workstation.tsx
git commit -m "feat(social): add SocialWorkstation main container"
```

---

### Task 14: Integration — Wire Into Skills Panel

**Files:**
- Modify: `src/components/skills/skills-panel.tsx` (add social workstation route)
- Modify: `src/config/skills-config.ts` (update social description/tags)

- [ ] **Step 1: Add SocialWorkstation import and route to skills-panel.tsx**

Add the import at the top of `src/components/skills/skills-panel.tsx`:

```ts
import { SocialWorkstation } from "./workstations/social/social-workstation";
```

Add the route before the `return <WorkstationPlaceholder skill={skill} />;` line:

```ts
    if (activeWorkstation === "social") {
      return <SocialWorkstation />;
    }
```

- [ ] **Step 2: Update skills-config.ts social entry**

Update the social entry in `src/config/skills-config.ts`:

```ts
  {
    id: "social",
    name: "社群發文模組",
    description: "素材轉社群貼文：FB・IG・LINE・學校網站・Notion 一鍵生成",
    icon: "📱",
    type: "workstation",
    tags: ["Facebook", "Instagram", "LINE", "Notion", "社群", "貼文"],
  },
```

- [ ] **Step 3: Verify the app compiles and runs**

```bash
npx tsc --noEmit --pretty 2>&1 | tail -5
```

Expected: No errors. Then open `http://localhost:3000`, navigate to Skills, click 社群發文模組 — should render the full workstation UI.

- [ ] **Step 4: Commit**

```bash
git add src/components/skills/skills-panel.tsx src/config/skills-config.ts
git commit -m "feat(social): wire SocialWorkstation into skills panel"
```

---

### Task 15: End-to-End Verification

- [ ] **Step 1: Verify the full flow in the browser**

1. Open `http://localhost:3000`
2. Navigate to Skills → 社群發文模組
3. Type text in the source input
4. Select FB + IG platforms, tone = 知識分享
5. Click ✨ 生成貼文
6. Verify: SSE streaming shows progress, then tabs appear with generated content
7. Click 📋 複製文字 — verify clipboard contains the text
8. Click 📝 存到 Notion — verify Notion page is created
9. Check history section shows the new post
10. Click the history item — verify it opens in Notion

- [ ] **Step 2: Test QMD search**

1. Switch to 搜尋筆記 mode
2. Search for a known note (e.g., "特教")
3. Click a result — verify it loads the note content into the text area

- [ ] **Step 3: Test image upload**

1. Drag an image into the upload area
2. Verify thumbnail appears
3. Generate + publish to Notion
4. Verify Image URLs field is populated in the Notion page

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat(social): complete social posting module MVP"
```
