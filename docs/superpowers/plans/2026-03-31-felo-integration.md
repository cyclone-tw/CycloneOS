# Felo 全面整合 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 將 Felo SuperAgent 能力整合進 CycloneOS — 共用 API client、Presentations 生圖/Web Fetch、獨立 Felo Workstation。

**Architecture:** 三層架構 — `lib/felo/` 共用 API client → `felo-output-store` 產出管理 → 兩個消費者（Presentations Skill + Felo Workstation）。檔案儲存透過 symlink 指向 Google Drive。

**Tech Stack:** Next.js 16, React 19, Zustand 5, TypeScript, Felo OpenAPI (SSE streaming)

**Design Spec:** `docs/superpowers/specs/2026-03-31-felo-integration-design.md`

---

## File Structure

### New Files
```
src/lib/felo/
├── types.ts                    ← Felo API 共用型別
├── client.ts                   ← 共用 fetch helper（auth header, base URL）
├── search.ts                   ← feloSearch() — POST /v2/chat
├── web-fetch.ts                ← feloWebFetch() — POST /v2/web/extract
├── livedoc.ts                  ← feloLiveDoc.list/create/delete()
└── superagent.ts               ← feloSuperAgent() — SSE 串流對話

src/stores/felo-output-store.ts ← FeloOutput[] Zustand store + persist

src/app/api/presentations/generate-image/route.ts  ← imagePrompt → 生圖 → 下載
src/app/api/presentations/fetch-url/route.ts        ← URL → Web Fetch → markdown
src/app/api/felo/chat/route.ts                      ← Felo Workstation SSE 對話

src/components/skills/workstations/felo/
├── felo-workstation.tsx        ← 主元件（resizable layout）
├── felo-chat.tsx               ← SuperAgent 對話區 + SSE 消費
├── felo-output-panel.tsx       ← 產出檔案面板
└── felo-shortcuts.tsx          ← 快捷入口列
```

### Modified Files
```
src/stores/documents-store.ts                       ← SourceItem type 加 "url"
src/config/skills-config.ts                         ← 新增 Felo skill 定義
src/components/skills/skills-panel.tsx               ← 新增 Felo workstation 路由
src/app/api/presentations/research/route.ts          ← 改用 lib/felo/search.ts
src/components/skills/workstations/presentations/
  slide-layout-editor.tsx                            ← 加「用此提示生圖」按鈕
  presentations-source-panel.tsx                     ← URL 智慧偵測
```

---

## Phase 1: Foundation

### Task 1: Setup symlink + directories

**Files:**
- Create: `public/uploads/felo` (symlink)

- [ ] **Step 1: 在 Google Drive 建立目錄結構**

```bash
mkdir -p ~/Library/CloudStorage/GoogleDrive-user@gmail.com/我的雲端硬碟/CycloneOS/Photos/images
mkdir -p ~/Library/CloudStorage/GoogleDrive-user@gmail.com/我的雲端硬碟/CycloneOS/Photos/documents
mkdir -p ~/Library/CloudStorage/GoogleDrive-user@gmail.com/我的雲端硬碟/CycloneOS/Photos/web-fetch
```

- [ ] **Step 2: 建立 public/uploads 目錄和 symlink**

```bash
mkdir -p public/uploads
ln -s ~/Library/CloudStorage/GoogleDrive-user@gmail.com/我的雲端硬碟/CycloneOS/Photos public/uploads/felo
```

- [ ] **Step 3: 驗證 symlink**

Run: `ls -la public/uploads/felo/`
Expected: 看到 `images/`, `documents/`, `web-fetch/` 三個子目錄

- [ ] **Step 4: 加入 .gitignore**

確認 `public/uploads/` 已在 .gitignore（避免 commit 二進位檔案）。

在 `.gitignore` 加入：
```
# uploaded files (symlink to Google Drive)
public/uploads/
```

- [ ] **Step 5: Commit**

```bash
git add .gitignore
git commit -m "chore: setup felo uploads symlink to Google Drive"
```

---

### Task 2: lib/felo/types.ts — 共用型別

**Files:**
- Create: `src/lib/felo/types.ts`

- [ ] **Step 1: 建立型別定義**

```typescript
// src/lib/felo/types.ts

// --- Felo Search ---

export interface FeloSearchResponse {
  data: {
    answer: string;
    resources: FeloResource[];
    query_analysis?: string[];
  };
}

export interface FeloResource {
  title?: string;
  link?: string;
  snippet?: string;
}

// --- Felo Web Fetch ---

export interface FeloWebFetchOptions {
  outputFormat?: "html" | "markdown" | "text";
  crawlMode?: "fast" | "fine";
  withReadability?: boolean;
  targetSelector?: string;
  timeout?: number;
}

export interface FeloWebFetchResponse {
  code: number;
  message: string;
  data: {
    content: string;
  };
}

// --- Felo LiveDoc ---

export interface FeloLiveDoc {
  short_id: string;
  name: string;
  description?: string;
  created_at: string;
  modified_at: string;
}

export interface FeloLiveDocListResponse {
  status: string;
  data: {
    total: number;
    items: FeloLiveDoc[];
  };
}

export interface FeloLiveDocCreateResponse {
  status: string;
  data: FeloLiveDoc;
}

// --- Felo SuperAgent ---

export interface FeloConversationResponse {
  stream_key: string;
  thread_short_id: string;
  live_doc_short_id: string;
}

export interface FeloSuperAgentOptions {
  query: string;
  liveDocId: string;
  threadId?: string;
  skillId?: string;
  acceptLanguage?: string;
}

export interface FeloStreamEvent {
  type: "message" | "stream" | "heartbeat" | "done" | "error";
  data?: string;
  offset?: number;
}

export interface FeloToolResult {
  toolName: string;
  title?: string;
  urls?: string[];
  status?: string;
}

export interface FeloSuperAgentResult {
  text: string;
  toolResults: FeloToolResult[];
  threadId: string;
  liveDocId: string;
}

// --- Felo Output Store ---

export interface FeloOutput {
  id: string;
  type: "image" | "document" | "web-fetch";
  localPath: string;
  prompt?: string;
  sourceUrl?: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/felo/types.ts
git commit -m "feat: add Felo API type definitions"
```

---

### Task 3: lib/felo/client.ts — 共用 fetch helper

**Files:**
- Create: `src/lib/felo/client.ts`

- [ ] **Step 1: 建立共用 client**

```typescript
// src/lib/felo/client.ts

const FELO_BASE_URL = process.env.FELO_API_BASE || "https://openapi.felo.ai";

function getApiKey(): string {
  const key = process.env.FELO_API_KEY;
  if (!key) throw new Error("FELO_API_KEY not configured");
  return key;
}

export async function feloFetch<T>(
  path: string,
  options: {
    method?: string;
    body?: Record<string, unknown>;
    timeout?: number;
  } = {},
): Promise<T> {
  const { method = "POST", body, timeout = 60_000 } = options;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const res = await fetch(`${FELO_BASE_URL}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${getApiKey()}`,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => "Unknown error");
      throw new Error(`Felo API ${res.status}: ${errorText}`);
    }

    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

export function feloStreamUrl(path: string): string {
  return `${FELO_BASE_URL}${path}`;
}

export { getApiKey, FELO_BASE_URL };
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/felo/client.ts
git commit -m "feat: add Felo shared API client"
```

---

### Task 4: lib/felo/search.ts

**Files:**
- Create: `src/lib/felo/search.ts`

- [ ] **Step 1: 建立 search client**

```typescript
// src/lib/felo/search.ts

import { feloFetch } from "./client";
import type { FeloSearchResponse, FeloResource } from "./types";

export interface FeloSearchResult {
  answer: string;
  resources: FeloResource[];
}

export async function feloSearch(query: string): Promise<FeloSearchResult> {
  const res = await feloFetch<FeloSearchResponse>("/v2/chat", {
    body: { query },
  });

  return {
    answer: res.data?.answer || "",
    resources: res.data?.resources || [],
  };
}
```

- [ ] **Step 2: 驗證 — 修改 research route 引入測試**

暫時在 research route 頂部加一行確認 import 不報錯：

Run: `npx tsc --noEmit src/lib/felo/search.ts`
Expected: 無錯誤（或只有 path alias 警告）

- [ ] **Step 3: Commit**

```bash
git add src/lib/felo/search.ts
git commit -m "feat: add Felo search API client"
```

---

### Task 5: lib/felo/web-fetch.ts

**Files:**
- Create: `src/lib/felo/web-fetch.ts`

- [ ] **Step 1: 建立 web-fetch client**

```typescript
// src/lib/felo/web-fetch.ts

import { feloFetch } from "./client";
import type { FeloWebFetchOptions, FeloWebFetchResponse } from "./types";

export async function feloWebFetch(
  url: string,
  options: FeloWebFetchOptions = {},
): Promise<string> {
  const {
    outputFormat = "markdown",
    crawlMode = "fast",
    withReadability = true,
    targetSelector,
    timeout = 60_000,
  } = options;

  const body: Record<string, unknown> = {
    url,
    output_format: outputFormat,
    crawl_mode: crawlMode,
    with_readability: withReadability,
  };

  if (targetSelector) body.target_selector = targetSelector;

  const res = await feloFetch<FeloWebFetchResponse>("/v2/web/extract", {
    body,
    timeout,
  });

  return res.data?.content || "";
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/felo/web-fetch.ts
git commit -m "feat: add Felo web-fetch API client"
```

---

### Task 6: lib/felo/livedoc.ts

**Files:**
- Create: `src/lib/felo/livedoc.ts`

- [ ] **Step 1: 建立 livedoc client**

```typescript
// src/lib/felo/livedoc.ts

import { feloFetch } from "./client";
import type {
  FeloLiveDoc,
  FeloLiveDocListResponse,
  FeloLiveDocCreateResponse,
} from "./types";

export const feloLiveDoc = {
  async list(): Promise<FeloLiveDoc[]> {
    const res = await feloFetch<FeloLiveDocListResponse>("/v2/live_docs", {
      method: "GET",
    });
    return res.data?.items || [];
  },

  async create(name: string, description?: string): Promise<FeloLiveDoc> {
    const res = await feloFetch<FeloLiveDocCreateResponse>("/v2/live_docs", {
      body: { name, description: description || "" },
    });
    return res.data;
  },

  async delete(shortId: string): Promise<void> {
    await feloFetch(`/v2/live_docs/${shortId}`, { method: "DELETE" });
  },

  /**
   * 取得或建立 LiveDoc。
   * 先查 list，有就取第一個；沒有就建新的。
   */
  async getOrCreate(name = "CycloneOS Workspace"): Promise<FeloLiveDoc> {
    const items = await this.list();
    if (items.length > 0) return items[0];
    return this.create(name);
  },
};
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/felo/livedoc.ts
git commit -m "feat: add Felo LiveDoc API client"
```

---

### Task 7: lib/felo/superagent.ts

**Files:**
- Create: `src/lib/felo/superagent.ts`

- [ ] **Step 1: 建立 superagent client**

這是最複雜的 client — 需要處理 SSE 串流、工具結果擷取、圖片 URL 收集。

```typescript
// src/lib/felo/superagent.ts

import { getApiKey, FELO_BASE_URL } from "./client";
import type {
  FeloSuperAgentOptions,
  FeloSuperAgentResult,
  FeloToolResult,
  FeloConversationResponse,
} from "./types";

/**
 * 呼叫 Felo SuperAgent — 建立或接續對話，消費 SSE 串流，
 * 回傳完整文字 + 工具結果（含圖片 URL）。
 *
 * 這是 blocking call：等串流完全結束才 resolve。
 * 適用於 API route 背景處理（如生圖）。
 */
export async function feloSuperAgent(
  opts: FeloSuperAgentOptions,
): Promise<FeloSuperAgentResult> {
  const { query, liveDocId, threadId, skillId, acceptLanguage = "zh" } = opts;
  const apiKey = getApiKey();

  // Step 1: Create or follow-up conversation
  const isFollowUp = !!threadId;
  const url = isFollowUp
    ? `${FELO_BASE_URL}/v2/conversations/${threadId}/follow_up`
    : `${FELO_BASE_URL}/v2/conversations`;

  const body: Record<string, unknown> = { query };
  if (!isFollowUp) {
    body.live_doc_short_id = liveDocId;
    if (skillId) body.skill_id = skillId;
  }

  const createRes = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Accept-Language": acceptLanguage,
    },
    body: JSON.stringify(body),
  });

  if (!createRes.ok) {
    const errText = await createRes.text().catch(() => "Unknown");
    throw new Error(`SuperAgent create failed ${createRes.status}: ${errText}`);
  }

  const convData = (await createRes.json()) as {
    data?: FeloConversationResponse;
  };
  const streamKey = convData.data?.stream_key;
  const resultThreadId = convData.data?.thread_short_id || threadId || "";
  const resultLiveDocId = convData.data?.live_doc_short_id || liveDocId;

  if (!streamKey) {
    throw new Error("No stream_key returned from SuperAgent");
  }

  // Step 2: Consume SSE stream
  const streamUrl = `${FELO_BASE_URL}/v2/conversations/stream/${streamKey}`;
  const streamRes = await fetch(streamUrl, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  if (!streamRes.ok || !streamRes.body) {
    throw new Error(`SSE stream failed: ${streamRes.status}`);
  }

  let text = "";
  const toolResults: FeloToolResult[] = [];
  const reader = streamRes.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (line.startsWith("data: ")) {
        const data = line.slice(6).trim();
        if (!data || data === "[DONE]") continue;

        try {
          const parsed = JSON.parse(data);

          // Text content
          if (parsed.content) {
            text += parsed.content;
          }

          // Tool results — extract image URLs
          if (parsed.tool_name || parsed.toolName) {
            const toolName = parsed.tool_name || parsed.toolName;
            const toolResult: FeloToolResult = { toolName };

            if (parsed.title) toolResult.title = parsed.title;
            if (parsed.status) toolResult.status = parsed.status;

            // Image URLs from generate_images
            if (toolName === "generate_images" && parsed.urls) {
              toolResult.urls = parsed.urls;
            } else if (toolName === "generate_images" && parsed.images) {
              toolResult.urls = parsed.images.map(
                (img: { url?: string }) => img.url,
              ).filter(Boolean);
            }

            toolResults.push(toolResult);
          }
        } catch {
          // Non-JSON data lines — append as text if it looks like content
          if (data && !data.startsWith("{") && !data.startsWith("[")) {
            text += data;
          }
        }
      }
    }
  }

  return {
    text,
    toolResults,
    threadId: resultThreadId,
    liveDocId: resultLiveDocId,
  };
}

/**
 * 從 SuperAgent 結果中提取所有圖片 URL。
 */
export function extractImageUrls(result: FeloSuperAgentResult): string[] {
  return result.toolResults
    .filter((t) => t.toolName === "generate_images" && t.urls)
    .flatMap((t) => t.urls || []);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/felo/superagent.ts
git commit -m "feat: add Felo SuperAgent SSE client"
```

---

### Task 8: felo-output-store

**Files:**
- Create: `src/stores/felo-output-store.ts`

- [ ] **Step 1: 建立 store**

```typescript
// src/stores/felo-output-store.ts

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { FeloOutput } from "@/lib/felo/types";

interface FeloOutputState {
  outputs: FeloOutput[];
  liveDocId: string | null;

  addOutput: (output: FeloOutput) => void;
  removeOutput: (id: string) => void;
  getByType: (type: FeloOutput["type"]) => FeloOutput[];
  getRecent: (limit?: number) => FeloOutput[];
  setLiveDocId: (id: string) => void;
}

export const useFeloOutputStore = create<FeloOutputState>()(
  persist(
    (set, get) => ({
      outputs: [],
      liveDocId: null,

      addOutput: (output) =>
        set({ outputs: [output, ...get().outputs] }),

      removeOutput: (id) =>
        set({ outputs: get().outputs.filter((o) => o.id !== id) }),

      getByType: (type) => get().outputs.filter((o) => o.type === type),

      getRecent: (limit = 20) => get().outputs.slice(0, limit),

      setLiveDocId: (id) => set({ liveDocId: id }),
    }),
    {
      name: "cycloneos-felo-outputs",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
```

- [ ] **Step 2: 驗證 type check**

Run: `npx tsc --noEmit src/stores/felo-output-store.ts`
Expected: 無錯誤

- [ ] **Step 3: Commit**

```bash
git add src/stores/felo-output-store.ts
git commit -m "feat: add Felo output store with localStorage persist"
```

---

### Task 9: Phase 1 整合驗證

- [ ] **Step 1: 確認所有 lib/felo/ 檔案 type check 通過**

Run: `npx tsc --noEmit`
Expected: 無新增錯誤（可能有既有的警告，忽略即可）

- [ ] **Step 2: Commit Phase 1 完成標記**

```bash
git add -A
git commit -m "feat: complete Felo API client library and output store (Phase 1)"
```

---

## Phase 2: Presentations 增強

### Task 10: 重構 research route

**Files:**
- Modify: `src/app/api/presentations/research/route.ts`

- [ ] **Step 1: 改用 lib/felo/search.ts**

將 `route.ts` 中直接 fetch Felo API 的部分換成 `feloSearch()`：

```typescript
// src/app/api/presentations/research/route.ts

import { NextRequest } from "next/server";
import { getLLMProvider } from "@/lib/llm-provider";
import { feloSearch } from "@/lib/felo/search";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const { query } = await req.json();

  if (!query || typeof query !== "string") {
    return Response.json({ error: "query is required" }, { status: 400 });
  }

  // Step 1: Call Felo Search
  let feloAnswer = "";
  let feloResources: Array<{ title?: string; link?: string; snippet?: string }> = [];

  try {
    const result = await feloSearch(query);
    feloAnswer = result.answer;
    feloResources = result.resources;
  } catch (e) {
    return Response.json(
      { error: `Felo search failed: ${e instanceof Error ? e.message : e}` },
      { status: 502 },
    );
  }

  // Step 2: Use Claude Sonnet to synthesize (unchanged)
  const resourcesText = feloResources
    .map(
      (r) =>
        `- [${r.title || "Untitled"}](${r.link || ""}): ${r.snippet || ""}`,
    )
    .join("\n");

  const synthesisPrompt = `根據以下搜尋結果，整理成適合用於簡報的結構化研究摘要。

<search-query>${query}</search-query>

<search-answer>
${feloAnswer}
</search-answer>

<search-resources>
${resourcesText}
</search-resources>

請用以下格式輸出（語言與搜尋主題相同）：

# 研究：${query}

## 重點摘要
- （3-5 個 bullet points，每個 1-2 句）

## 關鍵數據
- （如有數字、統計、百分比，列出）

## 重要引述
- （如有值得引用的觀點）

## 來源
- [標題](URL)

只輸出上述格式的 markdown，不要加其他說明。`;

  const provider = getLLMProvider();

  let accumulated = "";
  try {
    for await (const event of provider.stream({
      prompt: synthesisPrompt,
      model: "sonnet",
      stdinPrompt: true,
      noMcp: true,
      noVault: true,
    })) {
      if (event.type === "text" && event.text) {
        accumulated += event.text;
      } else if (event.type === "error") {
        console.error("[research] stream error:", event.error);
      }
    }
  } catch (e) {
    return Response.json(
      { error: `LLM synthesis failed: ${e}` },
      { status: 500 },
    );
  }

  const synthesizedMarkdown = accumulated.trim();
  if (!synthesizedMarkdown) {
    return Response.json(
      { error: "Empty response from LLM" },
      { status: 500 },
    );
  }

  const sources = feloResources.map((r) => ({
    title: r.title || "",
    url: r.link || "",
  }));

  return Response.json({ content: synthesizedMarkdown, sources });
}
```

- [ ] **Step 2: 驗證**

Run: `npx tsc --noEmit src/app/api/presentations/research/route.ts`
Expected: 無錯誤

- [ ] **Step 3: Commit**

```bash
git add src/app/api/presentations/research/route.ts
git commit -m "refactor: research route uses lib/felo/search client"
```

---

### Task 11: Generate Image API Route

**Files:**
- Create: `src/app/api/presentations/generate-image/route.ts`

- [ ] **Step 1: 建立 generate-image route**

```typescript
// src/app/api/presentations/generate-image/route.ts

import { NextRequest } from "next/server";
import { feloLiveDoc } from "@/lib/felo/livedoc";
import { feloSuperAgent, extractImageUrls } from "@/lib/felo/superagent";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UPLOADS_DIR = join(process.cwd(), "public/uploads/felo/images");

export async function POST(req: NextRequest) {
  const { imagePrompt } = await req.json();

  if (!imagePrompt || typeof imagePrompt !== "string") {
    return Response.json({ error: "imagePrompt is required" }, { status: 400 });
  }

  try {
    // Step 1: Get or create LiveDoc
    const liveDoc = await feloLiveDoc.getOrCreate();

    // Step 2: Call SuperAgent to generate image
    const result = await feloSuperAgent({
      query: `Generate an image: ${imagePrompt}`,
      liveDocId: liveDoc.short_id,
      acceptLanguage: "en",
    });

    // Step 3: Extract image URLs
    const imageUrls = extractImageUrls(result);
    if (imageUrls.length === 0) {
      return Response.json(
        { error: "No images generated by SuperAgent" },
        { status: 502 },
      );
    }

    // Step 4: Download first image to local
    const imageUrl = imageUrls[0];
    const timestamp = Date.now();
    const filename = `felo-img-${timestamp}.png`;

    await mkdir(UPLOADS_DIR, { recursive: true });

    const imgRes = await fetch(imageUrl);
    if (!imgRes.ok) {
      return Response.json(
        { error: `Failed to download image: ${imgRes.status}` },
        { status: 502 },
      );
    }

    const imgBuffer = Buffer.from(await imgRes.arrayBuffer());
    const localFilePath = join(UPLOADS_DIR, filename);
    await writeFile(localFilePath, imgBuffer);

    const localPath = `/uploads/felo/images/${filename}`;

    return Response.json({
      localPath,
      prompt: imagePrompt,
      createdAt: new Date().toISOString(),
      allImageUrls: imageUrls,
    });
  } catch (e) {
    console.error("[generate-image] error:", e);
    return Response.json(
      { error: e instanceof Error ? e.message : "Image generation failed" },
      { status: 500 },
    );
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/presentations/generate-image/route.ts
git commit -m "feat: add generate-image API route (SuperAgent + download)"
```

---

### Task 12: 生圖 UI — slide editor 加「用此提示生圖」按鈕

**Files:**
- Modify: `src/components/skills/workstations/presentations/slide-layout-editor.tsx`

- [ ] **Step 1: 在 SlideGenerationButtons 中加入生圖按鈕和 loading state**

在 `SlideGenerationButtons` component 加入 `loadingGenImage` state 和 `handleGenerateImage` function。

在現有的 `SlideGenerationButtons` function 內：

將原本的 state 區域改為：

```typescript
const [loadingNotes, setLoadingNotes] = useState(false);
const [loadingImage, setLoadingImage] = useState(false);
const [loadingGenImage, setLoadingGenImage] = useState(false);
```

在 `generate` callback 之後加入 `handleGenerateImage`：

```typescript
const handleGenerateImage = useCallback(async () => {
  const prompt = slide.content.imagePrompt?.trim();
  if (!prompt) return;
  setLoadingGenImage(true);

  try {
    const res = await fetch("/api/presentations/generate-image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imagePrompt: prompt }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Unknown error" }));
      console.error("[GenerateImage]", err.error);
      return;
    }

    const data = await res.json();
    if (data.localPath) {
      updateSlideContent(slide.id, { backgroundImage: data.localPath });
    }
  } catch (e) {
    console.error("[GenerateImage] fetch failed:", e);
  } finally {
    setLoadingGenImage(false);
  }
}, [slide.id, slide.content.imagePrompt, updateSlideContent]);
```

- [ ] **Step 2: 在 Image Prompt textarea 下方加入生圖按鈕**

在 JSX 中，Image Prompt 的 `</div>` 之前（textarea 之後），加入：

```tsx
{hasImagePrompt && (
  <button
    onClick={handleGenerateImage}
    disabled={loadingGenImage}
    className="mt-1.5 w-full flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium bg-purple-600/80 hover:bg-purple-600 text-white border border-purple-500/40 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
  >
    {loadingGenImage ? (
      <Loader2 className="h-3 w-3 animate-spin" />
    ) : null}
    {loadingGenImage ? "生圖中..." : "🎨 用此提示生圖"}
  </button>
)}
```

- [ ] **Step 3: 驗證 UI**

Run: `npm run dev`
打開 presentations workstation → 選一個 slide → 按「生成圖片提示」→ 確認 textarea 下方出現紫色「用此提示生圖」按鈕。

- [ ] **Step 4: Commit**

```bash
git add src/components/skills/workstations/presentations/slide-layout-editor.tsx
git commit -m "feat: add 'generate image from prompt' button in slide editor"
```

---

### Task 13: Fetch URL API Route

**Files:**
- Create: `src/app/api/presentations/fetch-url/route.ts`

- [ ] **Step 1: 建立 fetch-url route**

```typescript
// src/app/api/presentations/fetch-url/route.ts

import { NextRequest } from "next/server";
import { feloWebFetch } from "@/lib/felo/web-fetch";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WEBFETCH_DIR = join(process.cwd(), "public/uploads/felo/web-fetch");

export async function POST(req: NextRequest) {
  const { url } = await req.json();

  if (!url || typeof url !== "string") {
    return Response.json({ error: "url is required" }, { status: 400 });
  }

  // Basic URL validation
  try {
    new URL(url);
  } catch {
    return Response.json({ error: "Invalid URL format" }, { status: 400 });
  }

  try {
    const content = await feloWebFetch(url, {
      outputFormat: "markdown",
      withReadability: true,
      crawlMode: "fast",
    });

    if (!content) {
      return Response.json(
        { error: "Empty content from URL" },
        { status: 502 },
      );
    }

    // Save to local file
    const timestamp = Date.now();
    const slug = new URL(url).hostname.replace(/\./g, "-");
    const filename = `${slug}-${timestamp}.md`;

    await mkdir(WEBFETCH_DIR, { recursive: true });
    await writeFile(join(WEBFETCH_DIR, filename), content, "utf-8");

    const localPath = `/uploads/felo/web-fetch/${filename}`;

    return Response.json({
      content,
      localPath,
      sourceUrl: url,
      createdAt: new Date().toISOString(),
    });
  } catch (e) {
    console.error("[fetch-url] error:", e);
    return Response.json(
      { error: e instanceof Error ? e.message : "URL fetch failed" },
      { status: 500 },
    );
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/presentations/fetch-url/route.ts
git commit -m "feat: add fetch-url API route (Felo web extract)"
```

---

### Task 14: SourceItem type 更新 + URL 智慧偵測

**Files:**
- Modify: `src/stores/documents-store.ts`
- Modify: `src/components/skills/workstations/presentations/presentations-source-panel.tsx`

- [ ] **Step 1: 在 SourceItem type 加入 "url"**

在 `src/stores/documents-store.ts` 的 `SourceItem.type` 加入 `"url"`：

```typescript
export interface SourceItem {
  id: string;
  type: "local" | "drive" | "notion" | "obsidian" | "text" | "research" | "url";
  path: string;
  name: string;
  isDirectory: boolean;
  textContent?: string;
  researchQuery?: string;
  sourceUrl?: string;      // For type="url" (original URL)
}
```

- [ ] **Step 2: 在 presentations-source-panel.tsx 的 paste panel 加入 URL 偵測**

在 `PresentationsSourcePanel` component 中加入新的 state 和 handler：

在現有的 state 宣告區加入：

```typescript
const [isFetchingUrl, setIsFetchingUrl] = useState(false);
```

加入 URL 偵測 helper 和 handler：

```typescript
const isUrl = (text: string) => {
  try {
    const url = new URL(text.trim());
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
};

const handleFetchUrl = async () => {
  const url = pasteText.trim();
  if (!isUrl(url) || isFetchingUrl) return;
  setIsFetchingUrl(true);
  try {
    const res = await fetch("/api/presentations/fetch-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Fetch failed" }));
      setError(err.error || `HTTP ${res.status}`);
      return;
    }
    const data = await res.json();
    addSources([
      {
        id: crypto.randomUUID(),
        type: "url",
        name: `URL：${new URL(url).hostname}`,
        path: "",
        isDirectory: false,
        textContent: data.content,
        sourceUrl: url,
      },
    ]);
    setPasteText("");
  } catch (e) {
    setError(e instanceof Error ? e.message : "Fetch URL failed");
  } finally {
    setIsFetchingUrl(false);
  }
};
```

- [ ] **Step 3: 在 paste panel 的 JSX 中加入 URL 偵測提示**

在「貼上文字」面板的 textarea 和「加入來源」按鈕之間，加入 URL 偵測提示：

```tsx
{/* URL detection hint */}
{pasteText.trim() && isUrl(pasteText) && (
  <div className="flex items-center gap-2 rounded-lg border border-purple-500/30 bg-purple-500/10 px-3 py-2">
    <span className="text-sm">🔗</span>
    <div className="flex-1">
      <p className="text-xs font-medium text-purple-300">偵測到 URL</p>
      <p className="text-[10px] text-cy-muted">要自動擷取網頁內容嗎？</p>
    </div>
    <button
      onClick={handleFetchUrl}
      disabled={isFetchingUrl}
      className="rounded-md bg-purple-600/80 px-3 py-1 text-xs font-medium text-white hover:bg-purple-600 disabled:opacity-50"
    >
      {isFetchingUrl ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : (
        "擷取"
      )}
    </button>
  </div>
)}
```

- [ ] **Step 4: 驗證 UI**

Run: `npm run dev`
打開 presentations → 按「貼上文字」→ 貼一個 URL（如 `https://example.com`）→ 確認出現紫色提示。

- [ ] **Step 5: Commit**

```bash
git add src/stores/documents-store.ts src/components/skills/workstations/presentations/presentations-source-panel.tsx
git commit -m "feat: add URL smart detection in source panel + fetch-url integration"
```

---

### Task 15: Phase 2 整合驗證

- [ ] **Step 1: Type check**

Run: `npx tsc --noEmit`
Expected: 無新增錯誤

- [ ] **Step 2: Dev server 驗證**

Run: `npm run dev`
確認：
1. Research 功能仍正常（改用 lib/felo/ 後）
2. Slide editor 有「用此提示生圖」按鈕
3. Source panel 貼 URL 有偵測提示

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: complete Presentations Felo enhancements (Phase 2)"
```

---

## Phase 3: Felo Workstation

### Task 16: Skill 註冊 + 路由

**Files:**
- Modify: `src/config/skills-config.ts`
- Modify: `src/components/skills/skills-panel.tsx`

- [ ] **Step 1: 在 skills-config.ts 新增 Felo skill**

在 `SKILLS` 陣列的 `presentations` 之後加入：

```typescript
{
  id: "felo",
  name: "Felo AI 工作站",
  description: "AI 生圖・Web 擷取・Deep Research・Logo 設計・通用對話",
  icon: "🤖",
  type: "workstation",
  tags: ["Felo", "AI", "生圖", "Research", "SuperAgent", "Web Fetch"],
},
```

- [ ] **Step 2: 在 skills-panel.tsx 新增路由**

在 `skills-panel.tsx` 頂部加入 import：

```typescript
import { FeloWorkstation } from "./workstations/felo/felo-workstation";
```

在 workstation 路由區（`if (activeWorkstation === "presentations")` 之後）加入：

```typescript
if (activeWorkstation === "felo") {
  return <FeloWorkstation />;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/config/skills-config.ts src/components/skills/skills-panel.tsx
git commit -m "feat: register Felo skill card and routing"
```

---

### Task 17: Felo Chat API Route

**Files:**
- Create: `src/app/api/felo/chat/route.ts`

- [ ] **Step 1: 建立 SSE chat route**

```typescript
// src/app/api/felo/chat/route.ts

import { NextRequest } from "next/server";
import { getApiKey, FELO_BASE_URL } from "@/lib/felo/client";
import { feloLiveDoc } from "@/lib/felo/livedoc";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const IMAGES_DIR = join(process.cwd(), "public/uploads/felo/images");

export async function POST(req: NextRequest) {
  const { query, threadId, liveDocId, skillId } = await req.json();

  if (!query || typeof query !== "string") {
    return Response.json({ error: "query is required" }, { status: 400 });
  }

  const apiKey = getApiKey();

  // Resolve LiveDoc ID
  let resolvedLiveDocId = liveDocId;
  if (!resolvedLiveDocId) {
    try {
      const doc = await feloLiveDoc.getOrCreate();
      resolvedLiveDocId = doc.short_id;
    } catch (e) {
      return Response.json(
        { error: `LiveDoc error: ${e instanceof Error ? e.message : e}` },
        { status: 500 },
      );
    }
  }

  // Create or follow-up conversation
  const isFollowUp = !!threadId;
  const convUrl = isFollowUp
    ? `${FELO_BASE_URL}/v2/conversations/${threadId}/follow_up`
    : `${FELO_BASE_URL}/v2/conversations`;

  const convBody: Record<string, unknown> = { query };
  if (!isFollowUp) {
    convBody.live_doc_short_id = resolvedLiveDocId;
    if (skillId) convBody.skill_id = skillId;
  }

  try {
    const createRes = await fetch(convUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Accept-Language": "zh",
      },
      body: JSON.stringify(convBody),
    });

    if (!createRes.ok) {
      const errText = await createRes.text().catch(() => "Unknown");
      return Response.json(
        { error: `SuperAgent error: ${createRes.status} ${errText}` },
        { status: 502 },
      );
    }

    const convData = await createRes.json();
    const streamKey = convData.data?.stream_key;
    const resultThreadId = convData.data?.thread_short_id || threadId || "";
    const resultLiveDocId = convData.data?.live_doc_short_id || resolvedLiveDocId;

    if (!streamKey) {
      return Response.json({ error: "No stream_key" }, { status: 502 });
    }

    // Consume Felo SSE and re-emit to client
    const streamUrl = `${FELO_BASE_URL}/v2/conversations/stream/${streamKey}`;
    const streamRes = await fetch(streamUrl, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (!streamRes.ok || !streamRes.body) {
      return Response.json({ error: "SSE stream failed" }, { status: 502 });
    }

    // Create our own SSE stream to the client
    const encoder = new TextEncoder();
    const feloReader = streamRes.body.getReader();
    const decoder = new TextDecoder();

    const stream = new ReadableStream({
      async start(controller) {
        const emit = (event: string, data: unknown) => {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
          );
        };

        // Emit initial state
        emit("state", {
          threadId: resultThreadId,
          liveDocId: resultLiveDocId,
        });

        let buffer = "";

        try {
          while (true) {
            const { done, value } = await feloReader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
              if (line.startsWith("data: ")) {
                const data = line.slice(6).trim();
                if (!data || data === "[DONE]") continue;

                try {
                  const parsed = JSON.parse(data);

                  if (parsed.content) {
                    emit("message", { content: parsed.content });
                  }

                  if (parsed.tool_name || parsed.toolName) {
                    const toolName = parsed.tool_name || parsed.toolName;

                    // Handle image downloads
                    if (toolName === "generate_images") {
                      const urls = parsed.urls || (parsed.images || []).map(
                        (img: { url?: string }) => img.url,
                      ).filter(Boolean);

                      const localPaths: string[] = [];
                      await mkdir(IMAGES_DIR, { recursive: true });

                      for (const imgUrl of urls) {
                        try {
                          const imgRes = await fetch(imgUrl);
                          if (imgRes.ok) {
                            const imgBuf = Buffer.from(await imgRes.arrayBuffer());
                            const fname = `felo-img-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.png`;
                            await writeFile(join(IMAGES_DIR, fname), imgBuf);
                            localPaths.push(`/uploads/felo/images/${fname}`);
                          }
                        } catch {
                          // Skip failed downloads
                        }
                      }

                      emit("tool-result", {
                        toolName,
                        title: parsed.title,
                        localPaths,
                      });
                    } else {
                      emit("tool-result", {
                        toolName,
                        title: parsed.title,
                        status: parsed.status,
                      });
                    }
                  }
                } catch {
                  // Non-JSON data — forward as message
                  if (data && !data.startsWith("{")) {
                    emit("message", { content: data });
                  }
                }
              }
            }
          }
        } catch (e) {
          emit("error", {
            message: e instanceof Error ? e.message : "Stream error",
          });
        }

        emit("done", {});
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
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Chat failed" },
      { status: 500 },
    );
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/felo/chat/route.ts
git commit -m "feat: add Felo chat SSE API route"
```

---

### Task 18: Felo Workstation — Shortcuts

**Files:**
- Create: `src/components/skills/workstations/felo/felo-shortcuts.tsx`

- [ ] **Step 1: 建立快捷入口列**

```tsx
// src/components/skills/workstations/felo/felo-shortcuts.tsx
"use client";

interface FeloShortcutsProps {
  onSelect: (prompt: string) => void;
}

const SHORTCUTS = [
  { icon: "🎨", label: "生圖", prompt: "幫我生成一張圖片：" },
  { icon: "🔗", label: "擷取 URL", prompt: "擷取這個網頁的內容：" },
  { icon: "🔍", label: "Research", prompt: "搜尋並整理以下主題：" },
  { icon: "✏️", label: "Logo", prompt: "設計一個 logo：" },
];

export function FeloShortcuts({ onSelect }: FeloShortcutsProps) {
  return (
    <div className="flex gap-1.5 px-3 py-2 border-b border-cy-border/30 bg-cy-bg/50">
      {SHORTCUTS.map((s) => (
        <button
          key={s.label}
          onClick={() => onSelect(s.prompt)}
          className="flex items-center gap-1 rounded-full border border-purple-500/30 bg-purple-500/10 px-2.5 py-1 text-[11px] text-purple-300 hover:bg-purple-500/20 transition-colors"
        >
          <span>{s.icon}</span>
          {s.label}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/skills/workstations/felo/felo-shortcuts.tsx
git commit -m "feat: add Felo shortcuts component"
```

---

### Task 19: Felo Workstation — Output Panel

**Files:**
- Create: `src/components/skills/workstations/felo/felo-output-panel.tsx`

- [ ] **Step 1: 建立產出面板**

```tsx
// src/components/skills/workstations/felo/felo-output-panel.tsx
"use client";

import { Trash2 } from "lucide-react";
import { useFeloOutputStore } from "@/stores/felo-output-store";

export function FeloOutputPanel() {
  const { outputs, removeOutput, liveDocId } = useFeloOutputStore();
  const recent = outputs.slice(0, 30);

  const typeIcon = (type: string) => {
    switch (type) {
      case "image": return "🖼️";
      case "document": return "📄";
      case "web-fetch": return "🔗";
      default: return "📎";
    }
  };

  return (
    <div className="flex h-full flex-col">
      {/* Output list */}
      <div className="flex-1 overflow-y-auto p-3">
        <h3 className="mb-2 text-xs font-medium text-cy-muted">產出檔案</h3>
        {recent.length === 0 ? (
          <p className="py-8 text-center text-xs text-cy-muted/50">
            尚無產出
          </p>
        ) : (
          <div className="space-y-1.5">
            {recent.map((o) => (
              <div
                key={o.id}
                className="flex items-center gap-2 rounded-lg bg-cy-input/30 p-2 group"
              >
                <span className="text-base">{typeIcon(o.type)}</span>
                <div className="flex-1 min-w-0">
                  <p className="truncate text-xs text-cy-text">
                    {o.localPath.split("/").pop()}
                  </p>
                  <p className="truncate text-[10px] text-cy-muted">
                    {o.prompt || o.sourceUrl || o.type}
                  </p>
                </div>
                <button
                  onClick={() => removeOutput(o.id)}
                  className="opacity-0 group-hover:opacity-100 text-cy-muted hover:text-cy-error transition-all"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* LiveDoc info */}
      <div className="border-t border-cy-border/30 p-3">
        <h3 className="mb-1 text-xs font-medium text-cy-muted">LiveDoc</h3>
        {liveDocId ? (
          <div className="text-[10px] text-cy-muted">
            <p>ID: {liveDocId.slice(0, 12)}...</p>
            <a
              href={`https://felo.ai/livedoc/${liveDocId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-purple-400 hover:text-purple-300"
            >
              在 Felo 開啟 ↗
            </a>
          </div>
        ) : (
          <p className="text-[10px] text-cy-muted/50">尚未建立</p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/skills/workstations/felo/felo-output-panel.tsx
git commit -m "feat: add Felo output panel component"
```

---

### Task 20: Felo Workstation — Chat Component

**Files:**
- Create: `src/components/skills/workstations/felo/felo-chat.tsx`

- [ ] **Step 1: 建立對話元件**

```tsx
// src/components/skills/workstations/felo/felo-chat.tsx
"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Loader2, Send } from "lucide-react";
import { useFeloOutputStore } from "@/stores/felo-output-store";
import { FeloShortcuts } from "./felo-shortcuts";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  toolResults?: Array<{
    toolName: string;
    title?: string;
    localPaths?: string[];
  }>;
}

export function FeloChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [threadId, setThreadId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { addOutput, setLiveDocId, liveDocId } = useFeloOutputStore();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleShortcut = (prompt: string) => {
    setInput(prompt);
  };

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isStreaming) return;

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: text.trim(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsStreaming(true);

    const assistantId = crypto.randomUUID();
    setMessages((prev) => [
      ...prev,
      { id: assistantId, role: "assistant", content: "", toolResults: [] },
    ]);

    try {
      const res = await fetch("/api/felo/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: text.trim(),
          threadId,
          liveDocId,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Request failed" }));
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: `❌ ${err.error || "Error"}` }
              : m,
          ),
        );
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) return;

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";

        for (const part of parts) {
          const lines = part.split("\n");
          let eventType = "";
          let dataLine = "";

          for (const line of lines) {
            if (line.startsWith("event: ")) eventType = line.slice(7).trim();
            else if (line.startsWith("data: ")) dataLine = line.slice(6).trim();
          }

          if (!dataLine) continue;

          try {
            const parsed = JSON.parse(dataLine);

            if (eventType === "state") {
              if (parsed.threadId) setThreadId(parsed.threadId);
              if (parsed.liveDocId) setLiveDocId(parsed.liveDocId);
            } else if (eventType === "message") {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? { ...m, content: m.content + (parsed.content || "") }
                    : m,
                ),
              );
            } else if (eventType === "tool-result") {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? {
                        ...m,
                        toolResults: [...(m.toolResults || []), parsed],
                      }
                    : m,
                ),
              );

              // Save image outputs to store
              if (parsed.toolName === "generate_images" && parsed.localPaths) {
                for (const lp of parsed.localPaths) {
                  addOutput({
                    id: crypto.randomUUID(),
                    type: "image",
                    localPath: lp,
                    prompt: text.trim(),
                    createdAt: new Date().toISOString(),
                  });
                }
              }
            }
          } catch {
            // skip
          }
        }
      }
    } catch (e) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: `❌ ${e instanceof Error ? e.message : "Error"}` }
            : m,
        ),
      );
    } finally {
      setIsStreaming(false);
    }
  }, [isStreaming, threadId, liveDocId, addOutput, setLiveDocId]);

  return (
    <div className="flex h-full flex-col">
      {/* Shortcuts */}
      <FeloShortcuts onSelect={handleShortcut} />

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.length === 0 && (
          <p className="py-16 text-center text-sm text-cy-muted/50">
            開始跟 Felo SuperAgent 對話
          </p>
        )}
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                msg.role === "user"
                  ? "bg-cy-accent/15 text-cy-text"
                  : "bg-cy-input/30 text-cy-text"
              }`}
            >
              <p className="whitespace-pre-wrap">{msg.content}</p>
              {msg.toolResults?.map((tr, i) => (
                <div key={i} className="mt-2 rounded border border-purple-500/20 bg-purple-500/5 p-2 text-xs">
                  <p className="text-purple-300 font-medium">{tr.toolName}: {tr.title || "完成"}</p>
                  {tr.localPaths?.map((lp, j) => (
                    <img key={j} src={lp} alt="" className="mt-1 max-h-32 rounded" />
                  ))}
                </div>
              ))}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-cy-border/30 p-3">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage(input)}
            placeholder="輸入訊息..."
            disabled={isStreaming}
            className="flex-1 rounded-lg border border-cy-border bg-cy-input/50 px-3 py-2 text-sm text-cy-text placeholder:text-cy-muted/50 focus:border-purple-500/50 focus:outline-none disabled:opacity-50"
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || isStreaming}
            className="rounded-lg bg-purple-600 px-3 py-2 text-white hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isStreaming ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/skills/workstations/felo/felo-chat.tsx
git commit -m "feat: add Felo chat component with SSE streaming"
```

---

### Task 21: Felo Workstation — 主元件

**Files:**
- Create: `src/components/skills/workstations/felo/felo-workstation.tsx`

- [ ] **Step 1: 建立 Workstation 主元件**

```tsx
// src/components/skills/workstations/felo/felo-workstation.tsx
"use client";

import { ArrowLeft } from "lucide-react";
import { useAppStore } from "@/stores/app-store";
import { FeloChat } from "./felo-chat";
import { FeloOutputPanel } from "./felo-output-panel";

export function FeloWorkstation() {
  const { setActiveWorkstation } = useAppStore();

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-cy-border/40 px-4 py-3">
        <button
          onClick={() => setActiveWorkstation(null)}
          className="text-cy-muted hover:text-cy-text transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <span className="text-lg">🤖</span>
        <div>
          <h2 className="text-sm font-semibold text-cy-text">
            Felo AI 工作站
          </h2>
          <p className="text-[11px] text-cy-muted">
            SuperAgent 對話・生圖・Web 擷取・Research
          </p>
        </div>
      </div>

      {/* Main content: chat + output panel */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Chat */}
        <div className="flex-1 flex flex-col min-w-0">
          <FeloChat />
        </div>

        {/* Right: Output panel */}
        <div className="w-64 border-l border-cy-border/30 flex flex-col">
          <FeloOutputPanel />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 驗證 — Dev server**

Run: `npm run dev`
打開 Skills → 確認看到「Felo AI 工作站」卡片 → 點進去 → 確認看到對話區 + 右側產出面板 + 快捷入口。

- [ ] **Step 3: Commit**

```bash
git add src/components/skills/workstations/felo/felo-workstation.tsx
git commit -m "feat: add Felo workstation main component"
```

---

### Task 22: Phase 3 最終驗證 + 整合 Commit

- [ ] **Step 1: Full type check**

Run: `npx tsc --noEmit`
Expected: 無新增錯誤

- [ ] **Step 2: Dev server 完整功能驗證**

Run: `npm run dev`
確認以下功能：
1. Skills 頁面有 Felo AI 工作站卡片
2. 點進去看到對話 UI + 快捷入口 + 產出面板 + LiveDoc 資訊
3. Presentations → slide editor 有「用此提示生圖」按鈕
4. Presentations → source panel 貼 URL 有偵測提示
5. Research 功能仍正常

- [ ] **Step 3: 最終 Commit**

```bash
git add -A
git commit -m "feat: complete Felo integration — Workstation + Presentations enhancements (Phase 3)"
```

---

## Summary

| Phase | Tasks | 說明 |
|-------|-------|------|
| Phase 1 | Task 1-9 | Foundation — lib/felo/ API client + output store + symlink |
| Phase 2 | Task 10-15 | Presentations — research 重構 + 生圖 + Web Fetch + URL 偵測 |
| Phase 3 | Task 16-22 | Felo Workstation — skill 註冊 + chat + output panel |

共 22 個 task，每個 task 都是獨立可 commit 的單元。
