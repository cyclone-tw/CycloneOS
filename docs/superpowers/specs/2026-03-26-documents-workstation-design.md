# Documents 工作站設計規格

> CycloneOS Dashboard — Documents Workstation Design Spec
> Date: 2026-03-26
> Phase: 2（Skills Panel 系列）
> Status: Approved for implementation

## 1. 概述

Documents 工作站是 CycloneOS Dashboard Skills 面板中的第一個完整工作站，提供「多源資料讀取 → AI 加工 → 多格式輸出」的完整文件處理能力。

### 核心特色

- **多源輸入**：本機資料夾/檔案、Google Drive、Notion workspace、Obsidian vault
- **四種使用模式**：自由產出、模板填充、單檔加工、PDF 操作
- **AI 模板填充**：指定 .docx 模板，AI 智慧填入多源資料
- **HTML 簡報**：reveal.js 滿版簡報，含圖片 placeholder + AI 建議提示詞
- **Session 歷史**：每個工作項目為獨立 session，持久化保存，可回顧

### 設計決策摘要

| 決策 | 結論 | 原因 |
|------|------|------|
| 佈局 | 左右分割（B 方案） | 左側配置 + 右側預覽/對話，簡報可即時預覽 |
| 來源選取 | Modal 瀏覽器 + 拖放快捷 | 正式選取走 Modal（多 tab），快速丟入走拖放 |
| AI 對話定位 | 專屬對話 + 指令式微調 | 獨立於主 Chat panel，每個工作項目一個 session |
| 文件預覽 | Level 1（AI 預覽 + AI 微調） | HTML 簡報用 iframe 完美預覽，DOCX 用 mammoth.js 近似預覽 |
| 模板管理 | 使用者指定目錄 + AI 可建立/改寫模板 | 模板是活的，可透過對話從頭打造或修改 |
| 實作策略 | Phase 2A 先跑通一條路徑，再補齊到完整功能 | 驗證架構可行性優先 |

## 2. 佈局設計

### 2.1 整體結構

```
┌─────────────────────────────────────────────────────────┐
│ ← Skills    📄 Documents 工作站              [模板庫]   │
├──────────────────┬──────────────────────────────────────┤
│                  │                                      │
│  📥 INPUT        │  👁️ PREVIEW                          │
│  ├ 來源清單      │  ┌────────────────────────────────┐  │
│  ├ + 新增來源    │  │                                │  │
│  └ 拖放區域      │  │   文件預覽區                    │  │
│                  │  │   (iframe / HTML render)        │  │
│  📋 TEMPLATE     │  │                                │  │
│  └ 模板選取      │  └────────────────────────────────┘  │
│                  │                                      │
│  📤 OUTPUT       │  🖼️ 圖片 Placeholder 管理列          │
│  ├ 格式勾選      │  (僅 HTML 簡報模式顯示)              │
│  └ 存放路徑      │                                      │
│                  │  🤖 AI 對話（指令式微調）             │
│  [▶ 開始處理]    │  └ 輸入框                            │
│                  │                                      │
├──────────────────┴──────────────────────────────────────┤
│  📚 工作歷史                                [新建工作]  │
└─────────────────────────────────────────────────────────┘
```

### 2.2 左側配置區（~280px 固定寬度）

**INPUT 區塊：**
- 已選來源清單（icon + 名稱 + 來源類型標記）
- 每個來源可單獨移除（× 按鈕）
- 「+ 新增來源」按鈕 → 開啟 Source Picker Modal
- 整個 INPUT 區支援拖放（從 Finder 拖入檔案/資料夾）
- 支援多選：多個資料夾、多個檔案、跨平台混合

**TEMPLATE 區塊：**
- 顯示當前選用的模板（或「無」）
- 點擊選取 → 開啟模板瀏覽器（讀取使用者指定的模板目錄）
- 模板目錄路徑可在設定中配置
- AI 可透過對話建立新模板或改寫現有模板

**OUTPUT 區塊：**
- 格式 checkbox 列表：
  - ☐ Markdown (.md)
  - ☐ DOCX (.docx)
  - ☐ PDF (.pdf)
  - ☐ HTML 簡報 (reveal.js)
  - ☐ PPTX (.pptx)
  - ☐ Excel (.xlsx)
- 存放路徑選取（本機路徑或 Drive 路徑）
- 可多選輸出格式

**開始處理按鈕：**
- 全寬按鈕，位於左側底部
- 至少選取一個來源 + 一個輸出格式才可按

### 2.3 右側預覽/對話區

**預覽區（上方，佔右側 ~60% 高度）：**
- 根據輸出格式動態切換預覽器：
  - HTML 簡報 → iframe 嵌入，含翻頁控制（◀ ▶）+ 全螢幕按鈕
  - DOCX → mammoth.js 轉 HTML 渲染
  - Markdown → markdown-it 渲染
  - PDF → iframe 或 pdf.js
- 處理前顯示空白狀態（「配置來源後按開始處理」）
- 處理中顯示進度指示

**圖片 Placeholder 管理列（簡報模式才顯示）：**
- 列出所有圖片預留位（Slide N + 位置 + 狀態）
- 每個 placeholder 顯示 AI 建議的提示詞
- 填入圖片的三種方式：
  - 📁 從本機選取
  - ☁️ 從 Drive 選取
  - 🎨 Canva MCP 生成（未來）
- 已填入的 placeholder 標記 ✅

**AI 對話區（下方，佔右側 ~40% 高度）：**
- 專屬於當前工作 session 的對話
- 指令式互動為主：「表格加寬」「第三頁重寫」「標題改 16pt」
- 也能回答關於資料的問題：「這份資料有幾頁？」
- 對話歷史隨 session 保存

## 3. Source Picker Modal

### 3.1 結構

```
┌──────────────────────────────────────────────────┐
│  選擇來源                                    [×] │
├──────────────────────────────────────────────────┤
│  [本機] [Google Drive] [Notion] [Obsidian]       │
├──────────────────────────────────────────────────┤
│                                                  │
│  📁 breadcrumb: Home / Documents / 會議資料      │
│  ┌────────────────────────────────────────────┐  │
│  │ ☐ 📁 2026-03/                             │  │
│  │ ☑ 📄 會議紀錄_0325.pdf          1.2 MB    │  │
│  │ ☑ 📄 出席名單.xlsx              45 KB     │  │
│  │ ☐ 📄 agenda_draft.md            12 KB     │  │
│  └────────────────────────────────────────────┘  │
│                                                  │
│  已選取：2 個檔案                                │
│                        [取消]  [確認新增]         │
└──────────────────────────────────────────────────┘
```

### 3.2 各 Tab 行為

| Tab | 瀏覽方式 | 選取單位 | 實作 |
|-----|---------|---------|------|
| 本機 | 檔案系統瀏覽器 | 檔案 / 資料夾 | 新 API route `/api/documents/browse` |
| Google Drive | Drive 檔案瀏覽器 | 檔案 / 資料夾 | 複用 Drive panel 的 StorageProvider |
| Notion | Workspace / Database 列表 | Page / Database | Notion MCP `notion-search` + `notion-fetch` |
| Obsidian | Vault 目錄瀏覽 | 檔案 / 資料夾 | 本機路徑瀏覽（同本機 tab，預設到 vault 路徑） |

### 3.3 拖放快捷

- INPUT 區整體是 drop zone
- 支援從 Finder 拖入檔案/資料夾
- 拖入時顯示高亮邊框 + 「放開以新增」提示
- Notion URL 可直接貼到 INPUT 區的文字框

## 4. 四種使用模式

### 4.1 自由產出

```
來源（多個）→ 描述需求 → 選輸出格式 → AI 產出新文件
```

- 不使用模板
- 使用者在 PROCESS 區（即 AI 對話）描述要做什麼
- AI 根據來源資料和需求產出指定格式文件

### 4.2 模板填充

```
來源（多個）→ 選 .docx 模板 → 描述填入邏輯 → AI 填入/改寫模板 → 產出 DOCX
```

- 選取模板後，AI 解析模板結構
- 使用者描述如何將來源資料對應到模板的各個位置
- AI 智慧填入，保持模板原有格式
- 預覽後可微調

### 4.3 單檔加工

```
單一檔案 → 選擇操作（摘要/翻譯/改寫）→ 產出
```

- 只需一個來源
- 快速操作，不需要複雜配置

### 4.4 PDF 操作

```
多個 PDF → 合併/拆分/重排頁面 → 產出 PDF
```

- 純檔案操作，不需要 AI 內容處理
- 預覽中可拖拉排序頁面（v2）

## 5. HTML 簡報功能

### 5.1 技術方案

- 使用 reveal.js 產出 HTML 簡報
- 固定比例：16:9（預設）或 4:3（可選）
- 每頁一個 slide，滿版內容
- 支援主題樣式（深色/淺色/自訂）

### 5.2 圖片 Placeholder 機制

```
AI 產出簡報骨架
  ├── 每個需要圖片的位置放入 placeholder div
  │     ├── data-placeholder-id="slide3-right"
  │     ├── data-prompt="專業數據圖表，藍色科技風格，深色背景"
  │     └── 顯示為虛線框 + 提示詞文字
  └── 圖片管理列顯示所有 placeholder 狀態
```

**填入圖片流程：**
1. 在圖片管理列點選目標 placeholder
2. 選擇圖片來源（本機/Drive/Canva MCP）
3. 圖片插入後即時更新預覽
4. 可替換已填入的圖片

### 5.3 預覽控制

- iframe 嵌入 reveal.js HTML
- 翻頁按鈕（◀ ▶）+ 頁碼顯示（Slide N / M）
- 全螢幕按鈕（開新視窗或 fullscreen API）
- 縮圖導航列（v2）

## 6. Session 管理

### 6.1 資料模型

```typescript
interface DocumentSession {
  id: string;                          // UUID
  name: string;                        // 自動命名或使用者自訂
  status: 'configuring' | 'processing' | 'completed';
  createdAt: string;                   // ISO 8601
  updatedAt: string;
  sources: SourceItem[];               // 多個來源
  template: TemplateItem | null;       // 選用的模板
  taskDescription: string;             // 使用者描述的任務
  outputConfig: OutputConfig;          // 輸出格式 + 路徑
  outputs: OutputFile[];               // 產出的檔案
  chatHistory: ChatMessage[];          // 對話歷史
  imagePlaceholders: ImagePlaceholder[]; // 簡報圖片位
}

interface SourceItem {
  id: string;
  type: 'local' | 'drive' | 'notion' | 'obsidian';
  path: string;                        // 檔案路徑或 Notion page ID
  name: string;                        // 顯示名稱
  isDirectory: boolean;
  accountId?: string;                  // Drive 帳號
}

interface TemplateItem {
  path: string;
  name: string;
  source: 'local' | 'drive';
}

interface OutputConfig {
  formats: OutputFormat[];             // ['md', 'docx', 'pdf', 'html-slides', 'pptx', 'xlsx']
  outputPath: string;                  // 存放路徑
  slideAspectRatio?: '16:9' | '4:3';  // 簡報比例
}

interface OutputFile {
  format: OutputFormat;
  path: string;
  size: number;
  createdAt: string;
}

interface ImagePlaceholder {
  id: string;
  slideNumber: number;
  position: string;                    // "右側", "滿版", "左側" 等
  suggestedPrompt: string;             // AI 建議的圖片提示詞
  imagePath: string | null;            // 已填入的圖片路徑
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

type OutputFormat = 'md' | 'docx' | 'pdf' | 'html-slides' | 'pptx' | 'xlsx';
```

### 6.2 持久化

- Session 資料存儲在 `documents-store.ts`（Zustand + persist middleware）
- 使用 localStorage 持久化（或未來遷移到 IndexedDB）
- 產出的檔案存在使用者指定的路徑（本機檔案系統）

### 6.3 歷史瀏覽

- 工作站底部顯示「📚 工作歷史」區塊
- 列表顯示：session 名稱、狀態、日期、來源數量、輸出格式
- 點擊歷史 session → 載入配置和產出，可繼續微調
- 「新建工作」按鈕 → 清空配置，開始新 session

## 7. 模板管理

### 7.1 模板庫

- 使用者指定一個模板存放目錄（可在設定中配置）
- 工作站讀取該目錄下的所有 .docx 檔案作為可用模板
- Header 上的「模板庫」按鈕可瀏覽/管理模板

### 7.2 AI 模板操作

透過 AI 對話可以：
- 從頭建立新模板：「幫我做一個 IEP 範本」
- 改寫現有模板：「把表頭改成新格式」
- 基於其他文件建立模板：「參考這份公文做一個範本」
- 產出的模板自動存入模板目錄

## 8. 組件結構

### 8.1 檔案樹

```
dashboard/src/
├── components/skills/workstations/
│   ├── documents/
│   │   ├── documents-workstation.tsx       # 主組件，左右分割佈局
│   │   ├── documents-source-panel.tsx      # 左側配置區
│   │   ├── source-list.tsx                 # 已選來源清單 + 拖放
│   │   ├── template-selector.tsx           # 模板選取
│   │   ├── output-config.tsx               # 輸出格式 + 路徑
│   │   ├── documents-preview.tsx           # 右側預覽區
│   │   ├── slide-preview.tsx               # HTML 簡報預覽
│   │   ├── docx-preview.tsx                # DOCX 預覽
│   │   ├── markdown-preview.tsx            # Markdown 預覽
│   │   ├── image-placeholder-bar.tsx       # 圖片 placeholder 管理
│   │   ├── documents-chat.tsx              # 指令式 AI 對話
│   │   ├── source-picker-modal.tsx         # Modal 檔案瀏覽器
│   │   └── session-history.tsx             # 工作歷史列表
│   └── workstation-placeholder.tsx         # 其他工作站的 placeholder（已有）
├── stores/
│   └── documents-store.ts                  # Documents session state
└── app/api/
    └── documents/
        ├── browse/route.ts                 # 本機檔案瀏覽 API
        ├── process/route.ts                # AI 處理 API
        ├── preview/route.ts                # 文件預覽 API
        └── template/route.ts               # 模板管理 API
```

### 8.2 關鍵整合

- **StorageProvider**：複用 Drive panel 的檔案存取介面（`lib/providers/`）
- **Notion MCP**：透過 `notion-search` + `notion-fetch` 讀取 workspace
- **Canva MCP**：未來整合圖片生成（`mcp__claude_ai_Canva__generate-design`）
- **app-store**：`activeWorkstation === "documents"` 時渲染此工作站

## 9. 實作分階段

### Phase 2A：跑通一條完整路徑（優先）

**目標：** 選本機檔案 → 描述任務 → 產出 Markdown，驗證架構可行

- [ ] documents-store.ts（Session 資料模型 + Zustand）
- [ ] documents-workstation.tsx（左右分割骨架）
- [ ] documents-source-panel.tsx（INPUT + OUTPUT 基本 UI）
- [ ] source-list.tsx（來源清單，僅支援本機檔案拖放）
- [ ] output-config.tsx（格式勾選，先支援 Markdown）
- [ ] documents-chat.tsx（基本對話 UI）
- [ ] documents-preview.tsx（Markdown 預覽）
- [ ] `/api/documents/browse` API（本機檔案瀏覽）
- [ ] `/api/documents/process` API（讀取來源 + AI 處理 + 產出）
- [ ] skills-panel.tsx 整合（activeWorkstation === "documents" 時渲染真實組件）

### Phase 2B：所有來源 + 模板填充

- [ ] source-picker-modal.tsx（Modal + 多 tab）
- [ ] Google Drive tab（複用 StorageProvider）
- [ ] Notion tab（MCP 整合）
- [ ] Obsidian tab（本機路徑預設到 vault）
- [ ] template-selector.tsx（模板瀏覽 + 選取）
- [ ] docx-preview.tsx（mammoth.js 預覽）
- [ ] `/api/documents/template` API
- [ ] DOCX 輸出支援
- [ ] PDF 輸出支援

### Phase 2C：HTML 簡報 + 圖片 Placeholder

- [ ] slide-preview.tsx（reveal.js iframe 預覽 + 翻頁）
- [ ] image-placeholder-bar.tsx（placeholder 管理）
- [ ] 圖片插入流程（本機/Drive 選取）
- [ ] HTML 簡報輸出（reveal.js 產出）
- [ ] AI 圖片提示詞建議

### Phase 2D：Session 歷史 + 完善

- [ ] session-history.tsx（歷史列表 + 載入）
- [ ] Session 持久化（localStorage / IndexedDB）
- [ ] PPTX 輸出
- [ ] Excel 輸出
- [ ] PDF 操作（合併/拆分）
- [ ] AI 模板建立/改寫
- [ ] Canva MCP 圖片生成整合

## 10. 設計原則

1. **左右分割是核心** — 配置和預覽永遠同時可見
2. **Session 是第一公民** — 每個工作項目都是可回溯的 session
3. **漸進式功能** — 每個 sub-phase 都是可用的，不是半成品
4. **複用優先** — StorageProvider、Notion MCP、Drive 帳號配置都複用現有基礎設施
5. **AI 對話是微調工具** — 不是通用聊天，是針對當前任務的指令式互動
6. **模板是活的** — 不只是選取，還能透過 AI 建立和改寫
7. **預覽分級** — HTML 簡報完美預覽，DOCX 近似預覽 + AI 微調，其他格式建議外部開啟
