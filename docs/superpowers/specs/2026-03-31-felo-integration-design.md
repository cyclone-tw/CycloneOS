# Felo 全面整合設計文件

> 日期：2026-03-31
> 狀態：Draft

## 概述

將 Felo SuperAgent 的能力整合進 CycloneOS Dashboard，包含兩個面向：

1. **Felo Skill Workstation** — 獨立的 skill 卡片，提供完整的 Felo SuperAgent 能力
2. **Presentations Skill 增強** — 借用 Felo 的生圖和 Web Fetch 能力

共用基礎設施：`lib/felo/` API client + `felo-output-store` 產出管理。

## 架構

```
src/lib/felo/                    ← 共用 Felo API client
  ├── search.ts                  ← POST /v2/chat（搜尋 + AI 摘要）
  ├── superagent.ts              ← SSE 串流對話 + 工具呼叫
  ├── web-fetch.ts               ← POST /v2/web/extract（URL 擷取）
  ├── livedoc.ts                 ← LiveDoc CRUD
  └── types.ts                   ← 共用型別

src/stores/felo-output-store.ts  ← 產出管理 Zustand store

Felo Skill Workstation           ← 獨立 skill，完整 Felo 能力
Presentations Skill              ← 借用 lib/felo/ 的生圖 + Web Fetch
```

## 設計決策

### D1. 生圖 UI — 串接式

在 slide editor 的「AI 輔助生成」區：

1. 使用者按「生成圖片提示」→ Claude 生成 imagePrompt
2. imagePrompt 顯示在 textarea 中，使用者可編輯
3. textarea 下方出現「用此提示生圖」按鈕
4. 按下後呼叫 `/api/presentations/generate-image` → loading spinner → 圖片出現

生圖按鈕只在有 imagePrompt 時出現。使用者可先微調提示再生圖，避免浪費 Felo API 點數。

### D2. 圖片儲存 — 一律下載到本地，不用 Felo URL

流程：
1. API route 呼叫 SuperAgent → 等 SSE 串流完成 → 拿到圖片 URL
2. 下載圖片到 Google Drive 路徑（透過 symlink）
3. 回傳本地路徑 `/uploads/felo/images/xxx.png` 給前端
4. 前端只用本地路徑顯示

不依賴 Felo URL 做即時顯示，因為：
- SuperAgent 生圖是非同步的，URL 在串流完成後才拿得到
- Felo URL 是否永久/會過期未知
- 下載到本地最穩定

### D3. 檔案儲存 — Google Drive + Symlink

儲存路徑：
```
~/Library/CloudStorage/GoogleDrive-user@gmail.com/我的雲端硬碟/CycloneOS/Photos/
├── images/        ← 生圖產出
├── documents/     ← 文件產出
└── web-fetch/     ← 網頁擷取產出
```

Symlink：
```bash
ln -s ~/Library/CloudStorage/GoogleDrive-user@gmail.com/我的雲端硬碟/CycloneOS/Photos public/uploads/felo
```

前端路徑：
- `/uploads/felo/images/xxx.png`
- `/uploads/felo/documents/xxx.md`
- `/uploads/felo/web-fetch/xxx.md`

Google Drive 串流模式下基本不佔本地空間。

### D4. Felo Skill — 獨立 skill 卡片

在 `skills-config.ts` 新增 Felo SuperAgent skill：
- id: `felo`
- type: `workstation`
- 完整的 Felo 能力面板

### D5. Felo Workstation — 混合式設計

對話為主 + 快捷入口 + 產出面板：

**左側 — 對話區：**
- 頂部快捷入口列：生圖、擷取 URL、Research、Logo（pill 按鈕）
- 快捷入口點擊後填入預設 prompt 或開啟專用輸入框
- 主體是 SuperAgent SSE 串流對話
- 支援 multi-turn（reuse thread_id）
- 底部輸入框

**右側 — 產出面板：**
- 上方：產出檔案列表（圖片、文件、web-fetch），帶縮圖和 metadata
- 下方：LiveDoc 資訊（ID、連結到 Felo 開啟）

### D6. 跨 Skill 共享 — felo-output-store

```typescript
interface FeloOutput {
  id: string
  type: "image" | "document" | "web-fetch"
  localPath: string       // /uploads/felo/images/xxx.png
  prompt?: string         // 生成時的 prompt
  sourceUrl?: string      // web-fetch 的來源 URL
  createdAt: string
  metadata?: Record<string, unknown>
}
```

Actions：
- `addOutput(output)` — Felo 生成完呼叫
- `removeOutput(id)` — 刪除
- `getByType(type)` — 篩選

Zustand + localStorage persist。Felo skill 寫入，Presentations 讀取。

### D7. Web Fetch 在 Presentations — 智慧偵測 URL

在「貼上文字」的 textarea 中自動偵測 URL：
- 使用者貼上內容
- 如果內容是 URL 格式，顯示提示：「偵測到 URL，要自動擷取網頁內容嗎？」
- 使用者確認 → 呼叫 `/api/presentations/fetch-url` → 擷取 markdown → 加入來源
- 如果使用者忽略提示，就當作純文字處理

SourceItem type 新增 `"url"`。

### D8. 圖片填入欄位 — 先用 backgroundImage

生圖完成後，先簡單地填入 `slide.content.backgroundImage`。後續可以加智慧判斷（根據版型 field config 決定最適欄位）。

## 元件清單

### 1. lib/felo/ — API Client Library

| 檔案 | 用途 |
|------|------|
| `src/lib/felo/types.ts` | 共用型別（FeloSearchResponse, FeloStreamEvent, etc） |
| `src/lib/felo/search.ts` | `feloSearch(query)` — POST /v2/chat |
| `src/lib/felo/superagent.ts` | `feloSuperAgent(opts)` — 建立對話 + 消費 SSE 串流，回傳工具結果 |
| `src/lib/felo/web-fetch.ts` | `feloWebFetch(url, opts)` — POST /v2/web/extract |
| `src/lib/felo/livedoc.ts` | `feloLiveDoc.list/create/delete()` — LiveDoc CRUD |

所有函式共用 `FELO_API_KEY` from `process.env`。Base URL: `https://openapi.felo.ai`。

### 2. felo-output-store

| 檔案 | 用途 |
|------|------|
| `src/stores/felo-output-store.ts` | Zustand store，管理 FeloOutput[]，persist to localStorage |

### 3. API Routes

| Route | 用途 |
|-------|------|
| `src/app/api/presentations/research/route.ts` | 改用 lib/felo/search.ts（現有 route 重構） |
| `src/app/api/presentations/generate-image/route.ts` | 新增：imagePrompt → SuperAgent → 下載圖片 → 回傳本地路徑 |
| `src/app/api/presentations/fetch-url/route.ts` | 新增：URL → Web Fetch → markdown → 回傳內容 |
| `src/app/api/felo/chat/route.ts` | 新增：Felo Workstation 的 SuperAgent 對話 API |

### 4. 前端元件

| 元件 | 用途 |
|------|------|
| `slide-layout-editor.tsx` | 修改：在 imagePrompt textarea 下方加「用此提示生圖」按鈕 |
| `presentations-source-panel.tsx` | 修改：textarea 智慧偵測 URL，顯示擷取提示 |
| `src/components/skills/workstations/felo/felo-workstation.tsx` | 新增：Felo Workstation 主元件 |
| `src/components/skills/workstations/felo/felo-chat.tsx` | 新增：SuperAgent 對話區 |
| `src/components/skills/workstations/felo/felo-output-panel.tsx` | 新增：產出檔案面板 |
| `src/components/skills/workstations/felo/felo-shortcuts.tsx` | 新增：快捷入口列 |

### 5. 設定變更

| 檔案 | 變更 |
|------|------|
| `src/config/skills-config.ts` | 新增 Felo skill 定義 |
| `src/components/skills/skills-panel.tsx` | 新增 Felo workstation 路由 |
| `src/stores/documents-store.ts` | SourceItem type 新增 `"url"` |

## LiveDoc 管理策略

沿用方案 B+：
- 全域共用一個 LiveDoc
- LiveDoc ID 存 localStorage（透過 felo-output-store 或獨立 key）
- 首次使用時：呼叫 `feloLiveDoc.list()` → 取第一個，或 `feloLiveDoc.create()` 建新的
- 跨 session 共用同一個 LiveDoc

## SuperAgent 對話管理

Felo Workstation 的對話：
- `thread_short_id` 存在 component state
- 新 thread：不傳 `--thread-id`
- 後續對話：傳 `--thread-id`
- 使用者可以開新話題（清除 thread_id）

Presentations 的生圖：
- 每次生圖都是獨立 thread（不需要 multi-turn）
- 不傳 `--thread-id`，每次新建對話

## 資料流

### 生圖流程（Presentations）

```
使用者按「生成圖片提示」
  → POST /api/presentations/refine { action: "generate-image-prompt" }
  → Claude 生成 imagePrompt
  → 顯示在 textarea，使用者可編輯

使用者按「用此提示生圖」
  → POST /api/presentations/generate-image { imagePrompt, slideId }
  → Server: feloLiveDoc.getOrCreate() → live_doc_id
  → Server: feloSuperAgent({ query: imagePrompt, liveDocId }) → SSE 串流
  → Server: 等 generate_images 工具結果 → 拿到圖片 URL
  → Server: 下載圖片到 Google Drive/.../CycloneOS/Photos/images/
  → Response: { localPath: "/uploads/felo/images/xxx.png", prompt, createdAt }
  → Client: feloOutputStore.addOutput({ type: "image", localPath, prompt, ... })
  → Client: updateSlideContent(slideId, { backgroundImage: localPath })
```

### Web Fetch 流程（Presentations）

```
使用者在 textarea 貼上 URL
  → 前端偵測到 URL 格式
  → 顯示「偵測到 URL，要擷取嗎？」提示
  → 使用者按「擷取」
  → POST /api/presentations/fetch-url { url }
  → Server: feloWebFetch(url, { outputFormat: "markdown", withReadability: true })
  → Server: 存檔到 Google Drive/.../CycloneOS/Photos/web-fetch/
  → Response: { content: "markdown...", localPath: "...", sourceUrl: url }
  → Client: feloOutputStore.addOutput({ type: "web-fetch", localPath, sourceUrl, ... })
  → Client: addSources([{ type: "url", textContent: content, ... }])
```

### SuperAgent 對話流程（Felo Workstation）

```
使用者輸入訊息（或點快捷入口）
  → POST /api/felo/chat { query, threadId?, liveDocId }
  → Server: feloSuperAgent({ query, threadId, liveDocId }) → SSE 串流
  → Server: API route 本身是 SSE endpoint，逐步轉發事件到前端
  → Server: 遇到工具結果（圖片/文件）→ 下載到對應子資料夾 → 在 SSE 事件中回傳本地路徑
  → Client SSE events:
      - { type: "message", content: "..." }         → 即時顯示對話文字
      - { type: "tool-result", toolName: "generate_images", localPath: "...", ... } → 顯示圖片 + addOutput()
      - { type: "state", threadId: "...", liveDocId: "..." }  → 更新對話 state
      - { type: "done" }                             → 串流結束
  → Client: 更新對話顯示 + 產出面板
```

## 錯誤處理

- **FELO_API_KEY 未設定**：API route 回傳 500 + 明確錯誤訊息
- **SuperAgent 串流逾時**：設定 10 分鐘 timeout，逾時回傳錯誤
- **圖片下載失敗**：回傳錯誤，前端顯示 toast
- **Google Drive 未掛載**：symlink 指向的路徑不存在，API route 寫檔時會 catch error，回傳明確訊息
- **LiveDoc 操作失敗**：自動重試一次，失敗則回傳錯誤
