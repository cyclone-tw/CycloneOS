# Presentations Workstation Design Spec

**Date:** 2026-03-26
**Status:** Draft
**Author:** Claude Code + User brainstorming session (#07)

## Validation Status

| 整合項目 | 狀態 | 備註 |
|---------|------|------|
| reveal.js HTML | ✅ 已驗證 | Documents 工作站已 work |
| Claude CLI spawn | ✅ 已驗證 | Documents 工作站已 work |
| Canva `generate-design` | ⚠️ 部分驗證 | POC 可產出設計，但 AI 會自編內容。注意：工具文件對 `presentation` type 支援有矛盾（enum 包含但描述說不支援），需 POC 確認 |
| Canva editing flow | ❌ 未驗證 | `start-editing-transaction` → `perform-editing-operations` → `commit` 需 POC |
| Canva 替代流程 | ❌ 未驗證 | 若 `generate-design` 不支援 presentation，備案為 `request-outline-review` → `generate-design-structured` 程式化呼叫（繞過 widget UI） |
| Felo PPT API | ❌ 未驗證 | `/v2/ppts` 端點需 POC 確認可用性 |
| Felo SuperAgent 圖片生成 | ❌ 未驗證 | `generate_images` tool 需 POC |
| source-list / source-picker 共用 | ⚠️ 需重構 | 目前硬耦合 `useDocumentsStore`，需改為 props callback |

## Overview

獨立的簡報工作站，與 Documents 工作站為混合關係（方案 C）：共用來源選擇元件和 Claude CLI spawn 機制，但有自己的編輯器、store、API 和輸出流程。

核心理念：**Multi-Renderer 架構** — 使用者先選渲染引擎，預覽即為最終成品，避免預覽與匯出的視覺落差。

## Architecture: Multi-Renderer (方案 C)

```
來源 → Claude 生大綱 JSON → 選渲染引擎 → 該引擎的預覽 → 編輯/精煉 → 匯出
```

三條輸出路徑：

| 路徑 | 適合場景 | 速度 | 費用 |
|------|---------|------|------|
| **reveal.js HTML** | 本地預覽、離線、嵌入網頁 | 即時 (< 1s) | 免費 |
| **Canva MCP** | 精美設計 + 精確控制內容 | 10-30s | Max 訂閱內 |
| **Felo PPT API** | 快速出一份 PPT | 15-60s | 年訂閱內 |

## Workflow

1. **選來源** — 拖入 PDF、貼 YT 連結、貼文字（複用 Documents 的 source picker）
2. **Claude 分析 → 生成結構化大綱** — JSON 格式，每頁有標題、內容、佈局建議
3. **大綱編輯器** — 拖曳調整頁序、修改文字、新增/刪除頁、設定圖片佔位（附 prompt）
4. **選風格 + 輸出格式** — 24 款風格模板 + 選擇 reveal.js / Canva / Felo
5. **生成預覽** — 根據選擇的輸出路徑渲染
6. **對話精煉** — 類似 Cowork 模式，在對話中針對特定頁微調
7. **匯出** — 下載 HTML / PPTX / PDF / 取得 Canva 連結

## Data Model

### PresentationSession

```typescript
interface PresentationSession {
  id: string
  name: string
  status: 'configuring' | 'generating' | 'editing' | 'exporting'
  sources: SourceItem[]          // 複用 Documents 的 SourceItem
  outline: SlideOutline
  renderer: 'revealjs' | 'canva' | 'felo'
  rendererState: RendererState   // 各引擎的中間狀態
  chatHistory: ChatMessage[]
  aspectRatio: '16:9' | '4:3'
  createdAt: number
}
```

### SlideOutline (Single Source of Truth)

```typescript
interface SlideOutline {
  title: string
  theme?: string                 // 風格名稱
  slides: SlideDefinition[]
}

interface SlideDefinition {
  id: string
  order: number
  layout: 'title' | 'content' | 'two-column' | 'image-full' | 'blank'
  blocks: SlideBlock[]
}

type SlideBlock = {
  id: string
  type: 'heading' | 'text' | 'list' | 'image' | 'placeholder'
  // 位置和大小（百分比 0-100，跨引擎通用）
  x: number
  y: number
  width: number
  height: number
} & (
  | { type: 'heading'; content: string; level: 1 | 2 | 3 }
  | { type: 'text'; content: string }
  | { type: 'list'; items: string[] }
  | { type: 'image'; src: string; alt: string }
  | { type: 'placeholder'; prompt: string; generatedSrc?: string }
)
```

### RendererState

```typescript
type RendererState =
  | { type: 'revealjs'; html?: string }
  | { type: 'canva'; designId?: string; transactionId?: string; elementMap?: Record<string, string>; pageDimensions?: { width: number; height: number } }
  | { type: 'felo'; taskId?: string; pptUrl?: string; theme?: string }

// ChatMessage 定義（與 Documents 的 DocChatMessage 結構一致）
interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
  targetSlideId?: string  // 針對特定頁面的修改
}

// SlideLayout 是 SlideDefinition.layout 的別名
type SlideLayout = SlideDefinition['layout']
```

**設計決策：**
- 區塊位置用百分比而非像素，16:9 和 4:3 都通用，也容易轉換到各引擎的座標系統
- `placeholder` 型區塊帶 prompt，生成後填入 `generatedSrc`
- `rendererState` 分引擎存各自需要的中間資料

## Component Architecture

### File Structure

```
dashboard/src/
├── components/skills/workstations/presentations/
│   ├── presentations-workstation.tsx   # 主容器（左右分欄）
│   ├── presentations-source-panel.tsx  # 左面板：來源 + 設定 + 生成按鈕
│   ├── outline-editor.tsx             # 大綱編輯器（拖曳排序、區塊編輯）
│   ├── slide-block-editor.tsx         # 單一區塊的編輯 UI
│   ├── renderer-picker.tsx            # 引擎選擇 UI
│   ├── slide-preview.tsx              # 右面板：根據所選引擎顯示預覽
│   ├── slide-thumbnail-list.tsx       # 左側投影片縮圖列
│   └── presentations-chat.tsx         # 對話精煉面板
├── stores/
│   └── presentations-store.ts         # Zustand store (with persist)
├── app/api/presentations/
│   ├── generate/route.ts              # Claude → 大綱 JSON (SSE)
│   ├── render/route.ts                # 大綱 → 引擎渲染
│   ├── image/route.ts                 # Felo 圖片生成 + Canva upload
│   └── chat/route.ts                  # 對話精煉
└── lib/
    └── presentations-utils.ts         # 共用工具（大綱轉換、座標轉換）
```

### Reuse from Documents Workstation

- `source-list.tsx`、`source-picker-modal.tsx` — 需先重構為 props callback 模式（目前硬耦合 `useDocumentsStore`）。重構方式：元件接受 `onAddSources`、`onRemoveSource` 等 callback props，各工作站的包裝元件負責連接各自的 store。
- `documents-utils.ts` 的 `cleanClaudeOutput` — 已在 shared lib
- `/api/documents/browse` — 檔案瀏覽 API 直接共用
- `SourceItem` 類型 — import from `documents-store.ts`（目前實作不含 `accountId`，Drive 支援待 Phase 2B）。注意：如果 Documents 先加了 `accountId`，Presentations 會自動繼承新欄位，不影響既有功能。

### Layout

```
┌─────────────────────────────────────────────────────┐
│  左面板 (360px)          │  右面板                    │
│  ┌─────────────────┐    │  ┌───────────────────────┐ │
│  │ 來源選擇        │    │  │                       │ │
│  │ (source picker) │    │  │   投影片預覽           │ │
│  ├─────────────────┤    │  │   (根據引擎渲染)       │ │
│  │ 引擎選擇        │    │  │                       │ │
│  │ ○ reveal.js     │    │  │                       │ │
│  │ ○ Canva         │    │  └───────────────────────┘ │
│  │ ○ Felo PPT      │    │  ┌───────────────────────┐ │
│  ├─────────────────┤    │  │                       │ │
│  │ 縮圖列          │    │  │   對話精煉             │ │
│  │ ┌──┐ ┌──┐ ┌──┐ │    │  │   (chat panel)        │ │
│  │ │1 │ │2 │ │3 │ │    │  │                       │ │
│  │ └──┘ └──┘ └──┘ │    │  └───────────────────────┘ │
│  ├─────────────────┤    │                            │
│  │ 大綱/區塊編輯器  │    │                            │
│  │ (選中頁的區塊)   │    │                            │
│  └─────────────────┘    │                            │
└─────────────────────────────────────────────────────┘
```

### New Dependencies

- `@dnd-kit/core` + `@dnd-kit/sortable` — 投影片排序 + 區塊拖曳
- `react-rnd` — 區塊在投影片內的自由定位和縮放（僅 reveal.js 模式）

## API Design

### 1. Generate Outline (`/api/presentations/generate`)

```
POST → SSE stream
```

跟 Documents 工作站同模式：spawn Claude CLI + stdin pipe prompt。

- **輸入：** `sources[]` + `aspectRatio` + 使用者的額外指示
- **Prompt：** 指示 Claude 讀取來源 → 產出 `SlideOutline` JSON（嚴格 schema）
- **輸出：** SSE stream，最終 event 包含完整 JSON 大綱
- Claude 決定每頁佈局和區塊位置，使用者之後可調整

### 2. Render (`/api/presentations/render`)

```
POST { outline, renderer, theme } → 根據引擎分流
```

**reveal.js 路徑（即時，< 1 秒）：**
```
SlideOutline JSON
  → outlineToRevealHtml()
  → 百分比座標轉 CSS absolute positioning
  → placeholder 區塊顯示為灰色虛線框 + prompt 文字
  → 回傳 HTML string → iframe 預覽
```
純前端轉換，不需要 API call。

**Canva 路徑（10-30 秒）：**

> ⚠️ 此流程尚未 POC 驗證。`generate-design` 可用（已驗證），但 editing flow 需要實測。

```
SlideOutline JSON
  → generate-design（用大綱的標題/描述 + 風格 prompt，type: "presentation"）
  → create-design-from-candidate → 拿到 designId
  → get-design-pages → 取得 pageDimensions（寬高像素）存入 rendererState
  → start-editing-transaction → 拿到 elementMap（blockId ↔ elementId 對應）
  → 逐頁 perform-editing-operations：
      - replace_text / find_and_replace_text：精確內容替換
      - insert_fill：圖片區塊上傳 + 插入（百分比 × pageDimensions → 像素座標）
      - position_element + resize_element：微調佈局
      - format_text：文字格式化
  → commit-editing-transaction
  → get-design-thumbnail → 回傳預覽圖
```

**錯誤處理：**
- `perform-editing-operations` 部分失敗 → 記錄失敗的操作，繼續 commit 已成功的部分，向前端回報哪些區塊未更新
- `commit-editing-transaction` 失敗 → 所有變更丟失，清除 `rendererState.transactionId`，提示使用者重新渲染
- 逾時（30 秒無回應）→ 呼叫 `cancel-editing-transaction` 清理，提示重試
- 偵測到 stale `transactionId`（如前次未正常結束）→ 自動開新 transaction

`rendererState.elementMap` 保留 blockId ↔ elementId 對應，後續精煉可增量更新。

**Felo 路徑（15-60 秒）：**
```
SlideOutline JSON
  → 轉換為 Felo prompt（含大綱結構 + 風格指定）
  → POST /v2/ppts { prompt, ppt_config: { ai_theme_id } }
  → 輪詢 /v2/tasks/{id}/status
  → 完成後取 ppt_url → 回傳下載連結 + 顯示縮圖
```
Felo 不支援逐頁微調，適合「快速出一份」場景。

### 3. Image Generation (`/api/presentations/image`)

```
POST { prompt, blockId } → 生成圖片 → 回傳 URL
```

1. 呼叫 Felo SuperAgent（`generate_images` tool）生成圖片
2. 拿到圖片 URL → 更新大綱 JSON 中 placeholder 的 `generatedSrc`
3. 如果當前引擎是 Canva → 額外呼叫 `upload-asset-from-url` + `insert_fill` 插入設計
4. 如果是 reveal.js → 前端直接用 URL 替換佔位框

### 4. Chat Refinement (`/api/presentations/chat`)

```
POST { message, sessionId, selectedSlideId? } → SSE stream
```

- Claude 收到修改指示 + 當前大綱 JSON + 選中的頁面 ID
- Claude 回傳修改後的大綱 JSON diff（只回傳變動的 slides）
- 前端合併 diff → 觸發當前引擎的增量渲染：
  - **reveal.js：** 即時重建 HTML
  - **Canva：** 只對變動的 element 呼叫 editing operations（不重建整份設計）
  - **Felo：** 需要整份重新生成（API 不支援局部修改）

## Outline Editor Interaction Design

### Slide Thumbnail List

- 左側垂直排列，用 `@dnd-kit/sortable` 拖曳重新排序
- 每個縮圖是大綱 JSON 的簡化渲染（標題 + 佈局示意）
- 點選縮圖 → 右側顯示該頁預覽 + 左下方顯示該頁的區塊列表
- 底部「+ 新增投影片」按鈕，選擇佈局模板

### Block Editor（選中某頁時）

左面板下方顯示該頁所有區塊：

```
┌────────────────────────┐
│ 📄 第 3 頁              │
│ layout: two-column      │  ← 可切換佈局
├────────────────────────┤
│ [H] 標題               │  ← 點擊展開編輯
│     "AI 在教育的應用"    │
│ [T] 左欄文字            │
│     "根據 2025 年研究..." │
│ [📷] 右欄圖片佔位        │
│     prompt: "教室裡..."  │
│     [🎨 生成圖片]        │  ← 呼叫 Felo 生圖
│ [+] 新增區塊            │
└────────────────────────┘
```

- 每個區塊可展開編輯內容（文字直接改、圖片換 URL 或改 prompt）
- 區塊可拖曳重新排序
- 刪除區塊（垃圾桶圖示）

### Visual Positioning（右側預覽上操作）

在 reveal.js 預覽模式下：
- 用 `react-rnd` 包裹每個區塊 → 可拖曳移動 + 拉角調整大小
- 拖曳結束 → 更新大綱 JSON 的 x/y/width/height（像素轉百分比）
- 預覽畫面同步更新

在 Canva/Felo 模式下：
- 禁用畫面上的拖曳（引擎自己控制佈局）
- 只能用左側區塊列表編輯內容

### Mode Capabilities Matrix

| 功能 | reveal.js | Canva | Felo |
|------|-----------|-------|------|
| 預覽畫面上拖曳區塊 | ✅ | ❌ | ❌ |
| 左側區塊內容編輯 | ✅ | ✅ | ✅ |
| 投影片排序 | ✅ | ✅（重新渲染） | ✅（重新生成） |
| 即時預覽更新 | 即時 | 10-30s | 需重新生成 |
| 圖片佔位生成 | ✅ | ✅ + 自動插入 | ✅（但整份重生） |
| 增量精煉 | ✅ | ✅（element 級） | ❌（整份重生） |

## Theme System (24 Themes)

### Theme Data Structure

```typescript
interface PresentationTheme {
  id: string
  name: string
  nameZh: string
  category: ThemeCategory
  // reveal.js
  revealTheme: string              // base reveal.js theme to extend
  revealColors: { bg: string; text: string; accent: string; secondary?: string }
  revealFonts: { heading: string; body: string; mono?: string }
  // Canva
  canvaStylePrompt: string         // 傳給 generate-design 的風格描述
  // Felo
  feloThemeId?: string             // /v2/ppt-themes 的 ID（如有對應）
}

type ThemeCategory =
  | 'consulting'    // 顧問商務
  | 'startup'       // 科技新創
  | 'modern'        // 現代設計
  | 'minimal'       // 極簡
  | 'data'          // 數據分析
  | 'education'     // 教育
  | 'asian'         // 日式/亞洲
  | 'institutional' // 政府/機構
  | 'creative'      // 創意表現
```

### Built-in Themes (24)

#### Consulting & Corporate
| ID | Name | 中文 | Primary Colors | Best For |
|----|------|------|---------------|----------|
| `mckinsey` | McKinsey Classic | 麥肯錫經典 | Navy #003A70, White | 策略報告、董事會簡報 |
| `bcg` | BCG Analytical | BCG 分析 | Green #00A651, White | 數據分析、市場報告 |
| `deloitte` | Deloitte Executive | Deloitte 行政 | Green #86BC25, Black | 轉型報告、風控 |
| `accenture` | Accenture Bold | Accenture 大膽 | Purple #A100FF, White | 科技策略、數位轉型 |

#### Tech & Startup
| ID | Name | 中文 | Primary Colors | Best For |
|----|------|------|---------------|----------|
| `yc-minimal` | YC Minimal | YC 極簡 | Orange #FF6600, White | 種子輪 pitch deck |
| `sequoia` | Sequoia Storyteller | 紅杉敘事 | Red #CC0000, White | Series A/B pitch |
| `dark-tech` | Dark Tech | 暗黑科技 | Cyan #00D4FF on #0D0D0D | 開發者工具、AI 產品 |

#### Modern Design
| ID | Name | 中文 | Primary Colors | Best For |
|----|------|------|---------------|----------|
| `glass` | Glassmorphism | 玻璃擬態 | Gradient + frosted white | 產品展示、品牌 |
| `bento` | Bento Grid | 便當格局 | Blue #0071E3 on light gray | 功能總覽、年報 |
| `neobrutal` | Neobrutalism | 新粗獷主義 | Yellow #FFDE59, black borders | 創意機構、行銷 |
| `editorial` | Editorial Magazine | 編輯雜誌 | Red #B91C1C on off-white | 品牌故事、內容行銷 |

#### Minimalist
| ID | Name | 中文 | Primary Colors | Best For |
|----|------|------|---------------|----------|
| `swiss` | Swiss Minimalist | 瑞士極簡 | Red #FF0000 accent on white | 設計、建築 |
| `soft` | Soft Minimal | 柔和極簡 | Pastel on warm white #FDF6F0 | 教育、HR、公益 |
| `mono-bold` | Monochrome Bold | 單色大字 | B/W + single accent | 演講、TED 風格 |

#### Data & Analytics
| ID | Name | 中文 | Primary Colors | Best For |
|----|------|------|---------------|----------|
| `dashboard` | Dashboard Analyst | 儀表板分析 | Multi-chart on navy #1E293B | QBR、財務分析 |
| `infographic` | Infographic Story | 資訊圖表故事 | Multi-color on white | 行銷報告、調查 |

#### Education
| ID | Name | 中文 | Primary Colors | Best For |
|----|------|------|---------------|----------|
| `academic` | Academic Formal | 學術正式 | Navy #1E3A5F on white | 研討會、論文 |
| `classroom` | Classroom Friendly | 教室親和 | Multi-color on warm cream | K-12、工作坊 |

#### Japanese / Asian
| ID | Name | 中文 | Primary Colors | Best For |
|----|------|------|---------------|----------|
| `takahashi` | Takahashi Method | 高橋流 | Black on white | 快講、衝擊型演講 |
| `zen` | Zen Harmony | 禪意和風 | Earth tones on #F5F0EB | 文化、設計哲學 |

#### Government / Institutional
| ID | Name | 中文 | Primary Colors | Best For |
|----|------|------|---------------|----------|
| `gov-official` | Government Official | 政府公務 | Blue #003366 on white | 政策、預算 |
| `institutional` | Institutional Trust | 機構信賴 | Navy #1B365D + gold #B8860B | 銀行、法律、NGO |

#### Creative
| ID | Name | 中文 | Primary Colors | Best For |
|----|------|------|---------------|----------|
| `aurora` | Gradient Aurora | 極光漸層 | White on gradient bg | 品牌故事、活動 |
| `noir` | Premium Noir | 尊爵黑金 | Gold #D4AF37 on black #0A0A0A | 高端、行政簡報 |

### Custom Theme

使用者可選「自訂」，輸入自然語言風格描述。系統將：
1. 傳給 Claude 生成對應的 `PresentationTheme` 結構（revealColors、revealFonts 等）
2. 原始描述直接作為 `canvaStylePrompt` 傳給 Canva
3. Felo 則選最接近的內建主題

## Export

| 匯出格式 | 來源引擎 | 方式 |
|---------|---------|------|
| **HTML** | reveal.js | 下載完整 HTML 檔（含 CDN 引用） |
| **PPTX** | Felo | 下載 `ppt_url` |
| **PPTX** | Canva | `export-design` → PPTX 格式 |
| **PDF** | Canva | `export-design` → PDF 格式 |
| **PDF** | reveal.js | 瀏覽器 print-to-PDF（加操作提示；未來可考慮 Puppeteer 伺服器端生成） |
| **Canva 連結** | Canva | 開啟 Canva 編輯器繼續設計 |

跨引擎匯出：如果用 reveal.js 編輯但想要 PPTX，走 Felo 路徑重新生成（帶上當前大綱）。

## Store (Zustand with Persist)

```typescript
export const usePresentationsStore = create(
  persist(
    (set, get) => ({
      sessions: [] as PresentationSession[],
      activeSessionId: null as string | null,

      // Session management
      createSession: (name: string) => { /* ... */ },
      deleteSession: (id: string) => { /* ... */ },
      setActiveSession: (id: string) => { /* ... */ },

      // Outline editing
      updateOutline: (outline: SlideOutline) => { /* ... */ },
      updateSlide: (slideId: string, updates: Partial<SlideDefinition>) => { /* ... */ },
      updateBlock: (slideId: string, blockId: string, updates: Partial<SlideBlock>) => { /* ... */ },
      reorderSlides: (slideIds: string[]) => { /* ... */ },
      addSlide: (layout: SlideLayout) => { /* ... */ },
      deleteSlide: (slideId: string) => { /* ... */ },

      // Renderer
      setRenderer: (renderer: 'revealjs' | 'canva' | 'felo') => { /* ... */ },
      setRendererState: (state: RendererState) => { /* ... */ },

      // Chat
      addChatMessage: (msg: ChatMessage) => { /* ... */ },

      // Image generation
      setBlockImage: (slideId: string, blockId: string, src: string) => { /* ... */ },
    }),
    {
      name: 'presentations-store',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ sessions: state.sessions }),
    }
  )
)
```

從一開始就加 persist，避免頁面重整丟資料。

## Registration

### skills-config.ts

```typescript
{
  id: 'presentations',
  name: '簡報工作站',
  description: '多來源 AI 簡報生成、編輯、匯出',
  icon: '📊',
  type: 'workstation',
  tags: ['簡報', 'slides', 'pptx', 'canva']
}
```

### skills-panel.tsx

```typescript
if (activeWorkstation === 'presentations') {
  return <PresentationsWorkstation />
}
```

## Technical Notes

- 使用者有老花眼，最小字型 13px，cy-muted 不低於 #94A3B8
- 使用者已付 Claude Max $100/月 + Felo 年訂閱，不想額外花 API key 費用
- spawn 改法已驗證：直接 spawn("claude", args) + stdin pipe
- Canva MCP 可用工具：generate-design, create-design-from-candidate, start-editing-transaction, perform-editing-operations, commit-editing-transaction, cancel-editing-transaction, export-design, upload-asset-from-url, get-design-pages, get-design-thumbnail
- Felo API：/v2/ppts（PPT 生成）、/v2/ppt-themes（主題列表）、SuperAgent generate_images（圖片生成）
- reveal.js 5.x via CDN，不需 npm install

## Image Generation Strategy

圖片佔位區塊的圖片生成採用雙引擎策略：

1. **Felo SuperAgent** — 透過 `/v2/conversations` + `generate_images` tool 生成圖片（年訂閱內）
2. **Canva `upload-asset-from-url`** — 將生成的圖片 URL 上傳到 Canva 並用 `insert_fill` 插入設計

流程：Felo 生圖 → 取得 URL → 更新大綱 JSON → 如果是 Canva 模式則額外上傳插入

## Relationship with Documents Workstation

**混合關係（方案 C）：**
- Documents 保留「快速產出」的簡單路徑（markdown/html-slides 輸出）
- Presentations 是獨立入口，import Documents 的來源選擇元件
- 有自己的編輯器（大綱 + 區塊 + 視覺定位）和輸出流程（三引擎）
- 共用：source-list、source-picker-modal（需先重構）、cleanClaudeOutput、/api/documents/browse

## Implementation Phases

### Phase P0: 前置作業 + POC
- 重構 `source-list.tsx` 和 `source-picker-modal.tsx` 為 props callback 模式
- POC Canva editing flow（`start-editing-transaction` → `perform-editing-operations` → `commit`）
- POC Felo PPT API（`/v2/ppts` + `/v2/tasks/{id}/status`）
- POC Felo SuperAgent 圖片生成（`generate_images` tool）

### Phase P1: reveal.js 端到端
- 建立 Presentations store（Zustand + persist）
- 建立基本 UI（左右分欄、來源選擇、引擎選擇）
- `/api/presentations/generate` — Claude 生成大綱 JSON
- `outlineToRevealHtml()` 轉換 + iframe 預覽
- HTML 匯出
- 註冊到 skills-config.ts

### Phase P2: 大綱編輯器
- 投影片縮圖列（@dnd-kit/sortable 拖曳排序）
- 區塊編輯器（新增/刪除/編輯區塊）
- react-rnd 視覺定位（在 reveal.js 預覽上拖曳）
- 風格選擇 UI（24 款主題）

### Phase P3: Canva 整合（依 P0 POC 結果）
- Canva 渲染路徑完整實作
- elementMap 增量更新
- 圖片上傳 + 插入
- PPTX / PDF 匯出

### Phase P4: Felo 整合 + 圖片生成
- Felo PPT 渲染路徑
- Felo SuperAgent 圖片生成
- 圖片佔位區塊 UI + 生成按鈕

### Phase P5: 對話精煉
- `/api/presentations/chat` — 大綱 diff 回傳
- 前端 diff 合併 + 增量渲染
- 跨引擎匯出（reveal.js → Felo PPTX）
