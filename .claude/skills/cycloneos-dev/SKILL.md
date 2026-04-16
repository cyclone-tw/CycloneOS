---
name: cycloneos-dev
description: "CycloneOS Dashboard 開發慣例：LLM 抽象層、API route 模式、Zustand store 模式、路徑管理、命名規範。開發 CycloneOS 時自動載入。"
user-invocable: false
---

# CycloneOS 開發慣例

開發 CycloneOS Dashboard 時，AI 必須遵守以下慣例。

---

## 最高原則：AI Agent 無關性

所有程式碼不得與特定 AI 綁死。

1. **LLM 呼叫走 `src/lib/llm-provider.ts`** — 不直接 import 特定 SDK
2. **Prompt 與邏輯分離** — prompt template 獨立，不寫死在元件或 route
3. **外部 API 獨立封裝** — 各服務封裝在 `src/lib/` 模組，與 AI 層解耦

---

## 技術棧

Next.js 16 + React 19 + TypeScript + Zustand + Tailwind CSS 4 + shadcn/ui + Better-SQLite3

部署：Mac Mini 常駐，Tailscale Serve（port 8445）

---

## 目錄結構慣例

```
src/
├── app/
│   ├── api/{domain}/          ← API Route Handlers（每個工作站一個目錄）
│   └── page.tsx               ← 單頁 Dashboard
├── components/
│   ├── chat/                  ← Chat/Agent 面板元件
│   ├── layout/                ← Sidebar, Header
│   ├── overview/              ← Overview 頁面元件
│   ├── skills/                ← 工作站 UI 元件
│   └── ui/                    ← shadcn/ui 基礎元件
├── config/
│   ├── paths-config.ts        ← 所有輸出路徑（統一管理）
│   ├── skills-config.ts       ← 工作站定義
│   ├── accounts.ts            ← Google Drive 帳號設定
│   └── education-modules.ts   ← 教育模組定義
├── lib/
│   ├── llm-provider.ts        ← LLM 抽象層（核心）
│   ├── {domain}/              ← 各領域封裝模組
│   └── ...
├── stores/
│   └── {domain}-store.ts      ← Zustand store（每工作站一個）
└── types/
```

---

## API Route 模式

所有 API route 遵循統一模式：

```typescript
// src/app/api/{domain}/{action}/route.ts
export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  // 1. Extract & validate request body
  const body = await req.json()
  
  // 2. Build domain-specific prompt
  const prompt = buildPrompt(body)
  
  // 3. Get LLM provider
  const provider = getLLMProvider()
  
  // 4. Stream response via SSE
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder()
      for await (const event of provider.stream(prompt, options)) {
        // event types: session, text, error, done
        controller.enqueue(encoder.encode(`event: ${event.type}\ndata: ${JSON.stringify(...)}\n\n`))
      }
      controller.close()
    }
  })
  
  return new Response(stream, { headers: { 'Content-Type': 'text/event-stream' } })
}
```

**重點**：
- Streaming-first（所有長時間操作用 async generator + SSE）
- JSON 解析三層 fallback：直接解析 → 去除 fence → 錯誤回報
- 使用 `cleanClaudeOutput()` 和 `fixJsonControlChars()` 清理 LLM 輸出

---

## Zustand Store 模式

```typescript
// src/stores/{domain}-store.ts

// 1. 定義領域型別
interface DomainItem { ... }

// 2. State + Actions 介面
interface DomainState {
  // State
  items: DomainItem[]
  isLoading: boolean
  error: string | null
  
  // Actions
  setItems: (items: DomainItem[]) => void
  addItem: (item: DomainItem) => void
  reset: () => void
}

// 3. Initial state
const initialState = { items: [], isLoading: false, error: null }

// 4. Create store
export const useDomainStore = create<DomainState>((set, get) => ({
  ...initialState,
  setItems: (items) => set({ items }),
  addItem: (item) => set({ items: [...get().items, item] }),
  reset: () => {
    // 清理資源（如 URL.revokeObjectURL）
    set(initialState)
  },
}))
```

**命名**：`use{Domain}Store`（如 `useSocialStore`, `useDocumentsStore`）

**規則**：
- Immutable updates（spread operator）
- Reset 時清理資源（ObjectURL 等）
- Getter 少用，mutation 都有明確的 setter

---

## 路徑管理

**所有輸出路徑統一在 `src/config/paths-config.ts`**，不要在其他地方硬寫路徑。

| 類型 | 輸出位置 |
|------|---------|
| Markdown | Obsidian Vault（`CycloneOS/outputs/`）|
| DOCX/XLSX | Google Drive（`CycloneOS/documents/`）|
| 圖片 | Google Drive（`CycloneOS/images/`）|
| 簡報 | Google Drive（`CycloneOS/slides/`）+ GitHub Pages |

**檔名格式**：`YYYY-MM-DD-{source}-{sanitized-summary}.{ext}`
- source: `"felo" | "research" | "webfetch" | "doc"`
- 使用 `sanitizeSummary()` 處理檔名

---

## LLM Provider 抽象層

`src/lib/llm-provider.ts` 定義了 `LLMProvider` 介面：

- `async *stream(prompt, options)` — 回傳 `AsyncIterable<LLMStreamEvent>`
- Event types: `session`, `text`, `error`, `done`
- 支援 Claude CLI / Codex CLI / OpenAI 三種 provider
- 透過 `LLM_PROVIDER` 環境變數切換
- `LLMRequestOptions` 支援：MCP 控制、vault context、自訂 model、permission mode

**新增 provider 時**：實作 `LLMProvider` 介面，在 `getLLMProvider()` 加 case。

---

## 新增工作站 Checklist

1. `src/config/skills-config.ts` — 新增 SkillCard 定義
2. `src/stores/{domain}-store.ts` — 建立 Zustand store
3. `src/app/api/{domain}/` — 建立 API routes
4. `src/lib/{domain}/` — 封裝領域邏輯
5. `src/components/skills/workstations/{domain}/` — 建立 UI 元件
6. `src/config/paths-config.ts` — 如有新輸出路徑，加在這裡

---

## 命名慣例

| 層級 | 格式 | 範例 |
|------|------|------|
| 元件 | PascalCase | `SpcMeetingPanel` |
| Store | `use{Domain}Store` | `useSocialStore` |
| API route | kebab-case 目錄 | `api/spc-meeting/generate` |
| Config 常數 | SCREAMING_SNAKE | `CWD`, `VAULT` |
| 型別 | PascalCase + interface | `interface DriveAccount` |
| 工具函式 | camelCase | `sanitizeSummary()` |
| 註解 | 中文為主 | `// 取得 LLM provider` |
