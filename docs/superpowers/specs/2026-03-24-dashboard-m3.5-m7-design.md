# CycloneOS Dashboard M3.5–M7 設計規格

> **日期：** 2026-03-24
> **狀態：** Draft (Rev.2 — spec review 修正)
> **作者：** Claude Code + Cyclone
> **前置：** Dashboard M1–M3 已完成（skeleton、chat、overview、Notion 待辦、markdown 渲染、sidebar 外部連結）

---

## 1. 目標與動機

CycloneOS Dashboard 目前只有 Overview + Chat 面板。使用者（特教老師）日常需要：

1. **Gmail** — 管理個人 + 學校兩個帳號的郵件，AI 輔助分類與草稿回覆
2. **Google Drive** — 瀏覽、搜尋、管理兩個帳號的檔案（公文、IEP、教材、講義）
3. **文件數位化** — 批次 OCR 掃描公文/PDF/照片，產出 .md/.docx/.pptx 存入 Obsidian 或 Drive

**核心設計原則：**
- Notion 是任務/行程的中心 hub（Calendar 不需要獨立整合）
- 兩個 Google Drive 帳號已在本地同步，優先用本地檔案操作（零 API、零 OAuth）
- 未來可插入 `gws` CLI 支援 Google 原生格式，但現階段不需要
- 程式碼架構必須好維護：provider 抽象層、可插拔、關注點分離

---

## 2. 系統架構

```
┌─────────────────────────────────────────┐
│         CycloneOS Dashboard             │  即時互動 UI
│         (Next.js · Workflow Mac)        │
├──────────┬──────────┬───────────────────┤
│  Gmail   │  Drive   │  Doc Pipeline     │
│  Panel   │  Panel   │  Panel            │
│          │          │                   │
│ 收件概覽 │ 雙帳號   │ 批次上傳          │
│ AI 分類  │ 瀏覽搜尋 │ OCR 進度          │
│ 搜尋讀取 │ CRUD     │ 結果預覽          │
│ 寫草稿   │ 跨帳號   │ 按鈕式選擇產出    │
└────┬─────┴────┬─────┴────────┬──────────┘
     │          │              │
 Gmail MCP   本地 FS        Claude Vision
 (已有)      (兩個 Drive)    API (OCR)

┌─────────────────────────────────────────┐
│       OpenClaw (Mac Mini · 24/7)        │  背景批次處理
├─────────────────────────────────────────┤
│  skill: mail-classifier                 │
│  skill: doc-filler                      │
│  skill: doc-pipeline                    │
└─────────────────────────────────────────┘

擴充端口（未來）
└── Provider 抽象層
    ├── LocalDriveProvider    ← 現在
    ├── GwsDriveProvider      ← 未來 gws CLI
    └── GoogleDocsProvider    ← 未來原生格式
```

### 2.1 Google Drive 帳號路徑

| 帳號 | 角色 | 本地路徑 |
|------|------|----------|
| user@gmail.com | 個人（Obsidian vault、學習課程、講義） | `~/Library/CloudStorage/GoogleDrive-user@gmail.com/我的雲端硬碟/` |
| cyclonetw@ksps.ntct.edu.tw | 學校（公文、IEP、教材、與同事共編資料夾） | `~/Library/CloudStorage/GoogleDrive-cyclonetw@ksps.ntct.edu.tw/我的雲端硬碟/` |

Obsidian vault 路徑（在個人帳號 Drive 內）：
```
~/Library/CloudStorage/GoogleDrive-user@gmail.com/我的雲端硬碟/Obsidian-Cyclone/
```

### 2.2 關鍵設計決策

| 決策 | 選擇 | 理由 |
|------|------|------|
| Calendar 整合 | 不做 | Notion 已是中心 hub，Discord bot + 公文系統寫入 Notion |
| Drive 操作方式 | 本地檔案系統 | 兩個帳號已本地同步，零 API 零 OAuth |
| OCR 引擎 | Claude Vision API | 中文公文辨識品質遠勝 Tesseract，低頻使用 token 成本可忽略 |
| 文件編輯 | python-docx / python-pptx | 不破壞排版，適合 template 填入場景 |
| gws CLI | 預留端口但不安裝 | .docx 存 Drive 自動同步即可，需要原生格式時再裝 |
| 產出格式選擇 | 手動按鈕式 | 使用者偏好自己決定，用下拉選單 / 按鈕，不打字 |

---

## 3. Provider 抽象層

所有外部服務操作都經過 provider 抽象層，確保可插拔、好維護。

### 3.1 StorageProvider

```typescript
// lib/providers/storage-provider.ts

interface FileEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  modifiedAt: string;
  mimeType?: string;
}

interface StorageProvider {
  readonly id: string;
  readonly name: string;
  readonly accountEmail: string;

  listFiles(dirPath: string): Promise<FileEntry[]>;
  readFile(filePath: string): Promise<Buffer>;
  writeFile(filePath: string, content: Buffer): Promise<void>;
  copyFile(src: string, dest: string): Promise<void>;
  moveFile(src: string, dest: string): Promise<void>;
  deleteFile(filePath: string): Promise<void>;
  search(query: string, dirPath?: string): Promise<FileEntry[]>;
  exists(filePath: string): Promise<boolean>;
  mkdir(dirPath: string): Promise<void>;
}
```

**現在：** `LocalDriveProvider` — 用 Node.js `fs` 模組讀寫本地 Google Drive 路徑。
**未來：** `GwsDriveProvider` — 用 `gws` CLI 操作雲端 API。切換時只改 `config/providers.ts` 註冊表。

### 3.2 DocumentProvider

```typescript
// lib/providers/document-provider.ts

interface ExportOptions {
  format: 'md' | 'docx' | 'pptx';  // 未來 M7 再加 'google-docs'
  templatePath?: string;      // 用既有 template 填入
  metadata?: Record<string, string>;
}

interface DocumentProvider {
  readonly id: string;
  readonly supportedFormats: string[];

  export(content: string, options: ExportOptions): Promise<Buffer | string>;
}

// 注意：format 不含 'google-docs'，等 M7 GwsDriveProvider 實作後再擴充
```

**現在：** `LocalDocumentProvider`
- `.md` → 直接寫文字
- `.docx` → python-docx subprocess
- `.pptx` → python-pptx subprocess

**未來：** `GoogleDocsProvider` → 用 gws API 建立 Google 原生格式。

### 3.3 Provider 註冊

```typescript
// config/providers.ts

interface ProviderRegistry {
  storage: Record<string, StorageProvider>;    // 'personal' | 'school' | ...
  document: DocumentProvider;
  // 未來: gmail, calendar, etc.
}
```

```typescript
// config/accounts.ts

interface DriveAccount {
  id: string;
  email: string;
  label: string;           // 顯示名稱：「個人」「學校」
  localBasePath: string;   // 本地 Google Drive 掛載路徑
  outputFolder: string;    // CycloneOS 產出資料夾名稱
}

const DRIVE_ACCOUNTS: DriveAccount[] = [
  {
    id: 'personal',
    email: 'user@gmail.com',
    label: '個人',
    localBasePath: '/Users/username/Library/CloudStorage/GoogleDrive-user@gmail.com/我的雲端硬碟',
    outputFolder: 'CycloneOS-output',
  },
  {
    id: 'school',
    email: 'cyclonetw@ksps.ntct.edu.tw',
    label: '學校',
    localBasePath: '/Users/username/Library/CloudStorage/GoogleDrive-cyclonetw@ksps.ntct.edu.tw/我的雲端硬碟',
    outputFolder: 'CycloneOS-output',
  },
];
```

---

## 4. Gmail Panel

### 4.1 功能

| 功能 | 說明 | 技術 |
|------|------|------|
| 收件概覽 | 顯示最近未讀/重要郵件，按時間排序 | Gmail MCP: `gmail_search_messages` |
| 搜尋 | 完整 Gmail 搜尋語法支援 | Gmail MCP: `gmail_search_messages` |
| 讀取郵件 | 點擊展開完整內容，支援對話串 | Gmail MCP: `gmail_read_message` / `gmail_read_thread` |
| AI 分類 | 自動分析郵件內容，建議 label（公務/家長/行政/個人） | Claude API + Gmail MCP: `gmail_list_labels` |
| 寫草稿 | 選擇郵件 → AI 生成回覆草稿 → 使用者確認 → 存為草稿 | Gmail MCP: `gmail_create_draft` |

**已知限制：**
- Gmail MCP **沒有** `modify_thread` / `modify_labels` 工具，AI 分類只能「建議」label，使用者需到 Gmail 手動套用
- Gmail MCP **沒有** `send_draft` 工具，草稿只能在 Dashboard 建立，需到 Gmail 發送
- Gmail MCP 目前只連線**單一帳號**（個人 user@gmail.com），學校帳號的郵件需另行處理（M7 scope 或等 MCP 支援多帳號）

### 4.2 元件結構

```
components/gmail/
├── gmail-panel.tsx        主面板容器（搜尋列 + 郵件列表 + 詳情）
├── mail-list.tsx          郵件列表（未讀標記、寄件者、摘要、時間）
├── mail-detail.tsx        郵件詳情（完整內容、對話串、附件列表）
├── mail-composer.tsx      草稿編輯器（AI 建議 + 手動修改）
└── label-manager.tsx      AI 分類建議面板（建議 only，無法自動套用 label）
```

### 4.3 API Routes

```
/api/gmail/messages    GET    搜尋+列表（q, maxResults, pageToken）
/api/gmail/thread      GET    讀取對話串（threadId）
/api/gmail/draft       POST   建立草稿（to, subject, body, threadId?）
/api/gmail/labels      GET    列出所有 labels
/api/gmail/classify    POST   AI 分類（messageId → 建議 labels）
```

### 4.4 資料流

```
使用者開啟 Gmail Panel
  → GET /api/gmail/messages?q=is:unread
  → Gmail MCP: gmail_search_messages
  → 顯示未讀郵件列表

使用者點擊一封郵件
  → GET /api/gmail/thread?threadId=xxx
  → Gmail MCP: gmail_read_thread
  → 顯示完整對話串

使用者點擊「AI 分類」
  → POST /api/gmail/classify { messageId }
  → Claude API 分析郵件內容
  → 回傳建議 labels + 信心度
  → 使用者一鍵確認套用

使用者點擊「AI 回覆」
  → Claude API 根據郵件內容生成草稿
  → 顯示在 mail-composer 中讓使用者修改
  → 確認後 POST /api/gmail/draft
  → Gmail MCP: gmail_create_draft
```

---

## 5. Drive Panel

### 5.1 功能

| 功能 | 說明 | 技術 |
|------|------|------|
| 雙帳號瀏覽 | 左右分欄或 tab 切換，瀏覽兩個帳號的資料夾結構 | Node.js fs (readdir) |
| 搜尋檔案 | 依檔名/類型搜尋 | Node.js fs (glob) |
| 檔案預覽 | 圖片直接預覽、文字檔讀取內容、Office 顯示 metadata | Node.js fs (readFile) |
| 上傳 | 拖拉檔案到指定資料夾 | Node.js fs (writeFile) |
| 下載 | 提供本地檔案路徑 / 複製到指定位置 | Node.js fs (copyFile) |
| 跨帳號操作 | 從 A 帳號複製/搬移到 B 帳號 | Node.js fs (cp / rename) |
| 新建資料夾 | 在指定帳號下建立新資料夾 | Node.js fs (mkdir) |
| 刪除 | 刪除檔案/資料夾（需確認） | Node.js fs (rm) |

### 5.2 元件結構

```
components/drive/
├── drive-panel.tsx        主面板容器（帳號切換 + 瀏覽器 + 預覽）
├── file-browser.tsx       資料夾瀏覽樹（點擊展開、麵包屑導航）
├── file-preview.tsx       檔案預覽（圖片 / 文字 / metadata）
└── account-switcher.tsx   帳號切換 tab（個人 / 學校）
```

### 5.3 API Routes

```
/api/drive/accounts    GET     列出可用帳號（id, email, label）
/api/drive/list        GET     瀏覽資料夾（accountId, path）
/api/drive/search      GET     搜尋檔案（accountId, query, path?）
/api/drive/read        GET     讀取檔案內容（accountId, path）
/api/drive/write       POST    寫入/上傳檔案（accountId, path, content）
/api/drive/copy        POST    複製檔案（srcAccount, srcPath, destAccount, destPath）
/api/drive/move        POST    搬移檔案（srcAccount, srcPath, destAccount, destPath）
/api/drive/mkdir       POST    新建資料夾（accountId, path）
/api/drive/delete      DELETE  刪除（accountId, path）— 需確認
```

### 5.4 安全性

- 所有路徑操作必須驗證在允許的 base path 內（防 path traversal）
- DELETE 操作 API 層不做，前端需二次確認
- 不允許存取 Google Drive 路徑之外的本地檔案系統

**Path traversal 防護實作（mandatory）：**

```typescript
// lib/providers/local-drive.ts
import path from 'path';
import fs from 'fs/promises';

function validatePath(account: DriveAccount, requestedPath: string): string {
  const basePath = account.localBasePath;
  const resolved = path.resolve(basePath, requestedPath);

  // 1. 確認解析後的路徑在 base path 內
  if (!resolved.startsWith(basePath)) {
    throw new Error('Path traversal detected');
  }

  // 2. 確認 realpath 也在 base path 內（防 symlink 攻擊）
  // 注意：檔案必須存在才能 realpath，寫入時只做 resolve 檢查
  return resolved;
}

async function validateExistingPath(account: DriveAccount, requestedPath: string): string {
  const resolved = validatePath(account, requestedPath);
  const real = await fs.realpath(resolved);
  if (!real.startsWith(account.localBasePath)) {
    throw new Error('Symlink points outside allowed directory');
  }
  return real;
}
```

每個 Drive API route 的第一行必須呼叫 `validatePath` 或 `validateExistingPath`。

---

## 6. Document Pipeline（文件數位化管道）

### 6.1 工作流程

```
Step 1: 批次上傳
  ┌─────────────────────────────────────┐
  │  拖拉上傳區                         │
  │  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐  │
  │  │.jpg │ │.pdf │ │.png │ │.pdf │  │
  │  └─────┘ └─────┘ └─────┘ └─────┘  │
  │  28 個檔案已選擇     [開始處理]     │
  └─────────────────────────────────────┘

Step 2: OCR 處理（顯示即時進度）
  ┌─────────────────────────────────────┐
  │  批次 #12 處理中...  18/28          │
  │  ████████████████░░░░░░  64%        │
  │                                     │
  │  ✅ 公文-001.jpg    完成            │
  │  ✅ 公文-002.jpg    完成            │
  │  🔄 會議紀錄.pdf    處理中 (p.3/5)  │
  │  ⏳ 收據.jpg        等待中          │
  └─────────────────────────────────────┘

Step 3: 批次結果總覽 + 按鈕式選擇
  ┌─────────────────────────────────────┐
  │  批次 #12 — 28 個檔案已處理         │
  │                                     │
  │  全選操作：                         │
  │  格式 [.md ▾]  存到 [Obsidian ▾]   │
  │  [全部套用]                         │
  │  ─────────────────────────────────  │
  │  逐筆選擇：                         │
  │  ☑ 公文-001.jpg  [預覽]            │
  │    「有關本校112學年度...」          │
  │    格式 [.docx ▾]  存到 [Drive學校 ▾] │
  │                                     │
  │  ☑ 收據.jpg      [預覽]            │
  │    「統一發票 金額：$1,200...」      │
  │    格式 [.md ▾]  存到 [Obsidian ▾]  │
  │                                     │
  │  [執行產出]                         │
  └─────────────────────────────────────┘

Step 4: 產出
  ┌─────────────────────────────────────┐
  │  產出完成！                         │
  │                                     │
  │  📁 Obsidian/.../2026-03-24-batch-12/ │
  │     ├── 收據.md                     │
  │     └── _index.md                   │
  │                                     │
  │  📁 Drive學校/.../2026-03-24-batch-12/ │
  │     ├── 公文-001.docx              │
  │     └── 公文-002.docx              │
  │                                     │
  │  [開啟資料夾]  [新批次]             │
  └─────────────────────────────────────┘
```

### 6.2 入口

| 入口 | 位置 | 行為 |
|------|------|------|
| Dashboard 上傳面板 | Doc Pipeline Panel 的 upload-zone | 拖拉上傳，即時處理，UI 顯示進度 |
| Drive 指定資料夾 | OpenClaw skill 監控 | 偵測到新檔案 → 自動 OCR → 結果存暫存 → 通知使用者到 Dashboard 做選擇 |
| Chat 對話指令 | Chat Panel 輸入 | 「幫我 OCR /path/to/files/」→ 觸發 pipeline → 跳轉到 Pipeline Panel 顯示進度 |

### 6.3 元件結構

```
components/doc-pipeline/
├── pipeline-panel.tsx     主面板容器（上傳 → 進度 → 結果 → 產出）
├── upload-zone.tsx        拖拉上傳區（支援批次、顯示檔案列表）
├── batch-review.tsx       批次結果總覽（OCR 內容預覽 + 逐筆/全選操作）
├── export-options.tsx     格式+位置選擇器（下拉選單按鈕式）
└── batch-history.tsx      歷史批次列表（過去的處理記錄）
```

### 6.4 API Routes

```
/api/doc-pipeline/upload       POST    接收批次上傳（multipart/form-data）
/api/doc-pipeline/status       GET     查詢批次處理進度（batchId）
/api/doc-pipeline/batch/[id]   GET     單批結果總覽（OCR 內容 + metadata）
/api/doc-pipeline/export       POST    執行產出（batchId, 每筆的 format + destination）
```

### 6.5 批次處理流程（後端）

```
1. 接收上傳 → 存到暫存目錄 ~/.cycloneos/pipeline/{batchId}/input/
2. 逐檔處理：
   a. 圖片（.jpg/.png） → 直接送 Claude Vision API
   b. PDF → 逐頁轉圖片 → 送 Claude Vision API
   c. 多頁 PDF → 合併各頁 OCR 結果
3. OCR 結果存到 ~/.cycloneos/pipeline/{batchId}/results/{filename}.json
   {
     sourceFile: "公文-001.jpg",
     content: "有關本校112學年度...",
     metadata: { type: "公文", confidence: 0.95, pages: 1 },
     preview: "有關本校112學年度特殊教育..." (前 100 字)
   }
4. 等使用者在 Dashboard 做選擇
5. 收到產出指令後：
   a. .md → 直接寫文字檔
   b. .docx → 呼叫 python-docx subprocess 產出
   c. .pptx → 呼叫 python-pptx subprocess 產出
6. 寫入目標路徑：
   - Obsidian: {vault}/Draco/doc-pipeline/{date}-batch-{id}/
   - Drive 個人: {personalDrive}/CycloneOS-output/{date}-batch-{id}/
   - Drive 學校: {schoolDrive}/CycloneOS-output/{date}-batch-{id}/
7. 每個目標資料夾附 _index.md（批次摘要）
```

### 6.6 OCR 成本估算

| 場景 | 檔案量 | 估計 Token | 估計成本 |
|------|--------|-----------|---------|
| 日常（幾份公文） | 5 頁 | ~7,500 | ~$0.11 |
| 中批次（一疊掃描） | 30 頁 | ~45,000 | ~$0.68 |
| 大批次（學期歸檔） | 100 頁 | ~150,000 | ~$2.25 |

完全可接受的成本範圍。

### 6.7 OCR 錯誤處理與安全機制

- **大批次確認閾值：** 當批次超過 50 頁時，前端顯示確認對話框（含估計 token 成本）
- **單檔逾時：** 每個檔案 OCR 處理上限 60 秒，超時標記為 `failed`
- **部分失敗處理：** 單檔失敗不影響整批，失敗檔案標記為 `failed` + 錯誤訊息，使用者可逐筆重試
- **API Key：** 使用 `ANTHROPIC_API_KEY` 環境變數（與 Chat 功能共用同一把 key）
- **暫存清理：** `~/.cycloneos/pipeline/` 下超過 7 天的批次資料由 cron job 自動清理
- **Rate limiting：** 批次內逐檔序列處理（不併發），避免觸發 API rate limit

---

## 7. OpenClaw Skills（背景處理）

### 7.1 mail-classifier

```yaml
觸發: cron 每 30 分鐘
流程:
  1. 搜尋最近未分類郵件（透過 Gmail MCP）
  2. Claude API 分析內容 → 判斷類別
  3. 產出分類建議（注意：Gmail MCP 無法自動標記 label，只能建議）
  4. 摘要 + 分類建議寫入 Obsidian daily note
  5. 使用者可在 Dashboard 看到建議，再手動到 Gmail 套用
```

> **已知限制：** 等 Gmail MCP 新增 `modify_thread` 工具後，可升級為自動套用 label。

### 7.2 doc-filler

```yaml
觸發: 手動（Claude Code 對話 / Dashboard）
流程:
  1. 指定 template .docx 路徑
  2. 提供填入資料（JSON 或自然語言）
  3. python-docx 複製 template → 替換 placeholder
  4. 產出存到指定 Drive 路徑
```

### 7.3 doc-pipeline（背景監控）

```yaml
觸發: cron 每 10 分鐘掃描指定 Drive 資料夾
流程:
  1. 偵測新檔案（與上次掃描比對）
  2. 自動 OCR 處理
  3. 結果存暫存
  4. 通知使用者（Discord / Dashboard notification）
  5. 等使用者到 Dashboard 做產出選擇
```

---

## 8. 程式碼目錄結構

```
dashboard/src/
├── app/
│   ├── api/
│   │   ├── gmail/
│   │   │   ├── messages/route.ts
│   │   │   ├── thread/route.ts
│   │   │   ├── draft/route.ts
│   │   │   ├── labels/route.ts
│   │   │   └── classify/route.ts
│   │   ├── drive/
│   │   │   ├── accounts/route.ts
│   │   │   ├── list/route.ts
│   │   │   ├── search/route.ts
│   │   │   ├── read/route.ts
│   │   │   ├── write/route.ts
│   │   │   ├── copy/route.ts
│   │   │   ├── move/route.ts
│   │   │   ├── mkdir/route.ts
│   │   │   └── delete/route.ts
│   │   ├── doc-pipeline/
│   │   │   ├── upload/route.ts
│   │   │   ├── status/route.ts
│   │   │   ├── batch/[id]/route.ts
│   │   │   └── export/route.ts
│   │   ├── notion/tasks/route.ts      ← M3 已完成
│   │   ├── chat/route.ts              ← 已有
│   │   ├── health/route.ts            ← 已有
│   │   ├── sessions/route.ts          ← 已有
│   │   ├── openclaw/route.ts          ← 已有
│   │   └── audit/route.ts             ← 已有
│   ├── layout.tsx
│   └── page.tsx
│
├── components/
│   ├── chat/                          ← 已完成
│   ├── layout/                        ← 已完成
│   ├── overview/                      ← 已完成
│   ├── gmail/
│   │   ├── gmail-panel.tsx
│   │   ├── mail-list.tsx
│   │   ├── mail-detail.tsx
│   │   ├── mail-composer.tsx
│   │   └── label-manager.tsx
│   ├── drive/
│   │   ├── drive-panel.tsx
│   │   ├── file-browser.tsx
│   │   ├── file-preview.tsx
│   │   └── account-switcher.tsx
│   ├── doc-pipeline/
│   │   ├── pipeline-panel.tsx
│   │   ├── upload-zone.tsx
│   │   ├── batch-review.tsx
│   │   ├── export-options.tsx
│   │   └── batch-history.tsx
│   └── ui/                            ← 已有 (shadcn)
│
├── lib/
│   ├── providers/
│   │   ├── types.ts                   ← FileEntry, ExportOptions 等共用型別
│   │   ├── storage-provider.ts        ← StorageProvider interface
│   │   ├── local-drive.ts             ← LocalDriveProvider（現在用）
│   │   ├── gmail-provider.ts          ← 封裝 Gmail MCP 呼叫
│   │   └── document-provider.ts       ← DocumentProvider interface
│   ├── doc-pipeline/
│   │   ├── ocr.ts                     ← Claude Vision OCR 封裝
│   │   ├── classifier.ts             ← 文件類型判斷
│   │   ├── exporter-md.ts            ← .md 產出
│   │   ├── exporter-docx.ts          ← .docx 產出 (python-docx subprocess)
│   │   └── exporter-pptx.ts          ← .pptx 產出 (python-pptx subprocess)
│   ├── claude-bridge.ts               ← 已有
│   ├── obsidian-reader.ts             ← 已有
│   ├── session-reader.ts              ← 已有
│   └── utils.ts                       ← 已有
│
├── stores/
│   ├── app-store.ts                   ← 更新：新增 gmail/drive/pipeline 頁面
│   ├── chat-store.ts                  ← 已有
│   ├── gmail-store.ts                 ← 郵件列表、選中郵件、搜尋狀態
│   ├── drive-store.ts                 ← 當前帳號、當前路徑、選中檔案
│   └── pipeline-store.ts             ← 批次列表、進度、結果
│
├── types/
│   ├── chat.ts                        ← 已有
│   ├── gmail.ts                       ← MailMessage, MailThread, Label, ClassifyResult
│   ├── drive.ts                       ← FileEntry, DriveAccount
│   └── pipeline.ts                    ← Batch, BatchItem, ExportConfig
│
└── config/
    ├── accounts.ts                    ← DriveAccount[] 設定
    └── providers.ts                   ← ProviderRegistry 註冊表
```

---

## 9. Sidebar 導航更新

```typescript
// 更新後的導航結構
NAV_ITEMS = [
  { page: "overview",  icon: "🏠", label: "Overview" },
  { page: "gmail",     icon: "📧", label: "Gmail" },
  { page: "drive",     icon: "💾", label: "Drive" },
  { page: "pipeline",  icon: "📄", label: "Documents" },
  // "files" 頁面由 Drive Panel 取代，移除
  { page: "search",    icon: "🔍", label: "Search" },
];

EXTERNAL_LINKS = [
  { icon: "📋", label: "Tasks (Notion)", url: "https://notion.so" },
];
// Calendar 外部連結移除
```

---

## 10. Chat Panel 強化 — Command Router + Session 管理

### 10.1 目標

Dashboard Chat 不只是問答工具，而是 CycloneOS 的**指令中心**。使用者可以透過自然語言下達工作指令，Chat 負責辨識意圖、呼叫對應功能、回報結果。

### 10.2 Command Router

```
使用者輸入自然語言
    ↓
Claude CLI 解析意圖
    ↓
┌─────────────────────────────────────────────┐
│  Command Router（意圖 → 動作映射）          │
├─────────────────────────────────────────────┤
│  「幫我 OCR 這批檔案」                      │
│    → POST /api/doc-pipeline/upload          │
│    → 跳轉到 Pipeline Panel 顯示進度        │
│                                             │
│  「把公文搬到學校帳號」                      │
│    → POST /api/drive/move                   │
│    → Chat 回報完成結果                      │
│                                             │
│  「最近有什麼未讀郵件？」                    │
│    → GET /api/gmail/messages?q=is:unread    │
│    → Chat 顯示郵件摘要列表                  │
│                                             │
│  「幫我分類最近的郵件」                      │
│    → POST /api/gmail/classify               │
│    → Chat 顯示分類建議                      │
│                                             │
│  「幫我回覆這封郵件」                        │
│    → POST /api/gmail/draft                  │
│    → Chat 顯示草稿預覽                      │
│                                             │
│  一般對話                                    │
│    → Claude CLI 直接回答                    │
└─────────────────────────────────────────────┘
```

**實作方式：**

兩種可行路線（M4 scope 再決定）：

- **路線 A：Claude CLI 自帶 tool use** — 在 `claude-bridge.ts` 啟動 Claude CLI 時注入可用工具定義（Dashboard API endpoints），讓 Claude 自行判斷何時呼叫。優點是自然語言解析能力最強，缺點是依賴 Claude CLI 的 tool use 支援。

- **路線 B：前端 intent detection** — Chat 收到 Claude 回覆後，用正則/關鍵字偵測是否包含可執行動作（如 URL、檔案路徑、API 呼叫建議），自動生成「執行」按鈕。優點是不依賴 CLI 能力，缺點是解析精度較低。

### 10.3 Chat Session 管理

```
Chat Session 生命週期：
┌─────────┐    ┌─────────┐    ┌──────────────┐
│ 開始對話 │ →  │ 對話中  │ →  │ 結束 session  │
│         │    │ (工作中) │    │ → 自動歸檔    │
└─────────┘    └─────────┘    └──────────────┘
                                     │
                              ┌──────▼──────┐
                              │ Session Log │
                              │ 寫入 Obsidian│
                              └─────────────┘
```

**Session Log 歸檔規則：**

| 項目 | 規格 |
|------|------|
| 觸發時機 | 使用者點擊「新對話」按鈕 / 手動輸入「重起 session」 |
| 存放位置 | `${VAULT}/CycloneOS/sessions/` |
| session-type | `dashboard-chat` |
| 內容 | 對話摘要（由 Claude 自動生成）+ 執行的指令列表 + 產出檔案路徑 |
| 命名 | 與現有 session log 共用流水號（`YYYY-MM-DD-session-NN.md`） |

**Session Log 格式：**

```markdown
---
type: session-log
date: YYYY-MM-DD
session: NN
source: cycloneos
session-type: dashboard-chat
tags: [cycloneos, dashboard-chat]
outputs: []
---

# YYYY-MM-DD Session NN (Dashboard Chat)

## 對話摘要
（Claude 自動生成的 1-2 句摘要）

## 執行的指令
- [時間] 指令描述 → 結果
- [時間] 指令描述 → 結果

## 產出檔案
- （如有）

## 對話記錄（精簡版）
- 🧑 使用者：...
- 🤖 Claude：...
```

### 10.4 Chat UI 更新

```
components/chat/
├── chat-panel.tsx          ← 更新：加入 session 管理
│   ├── 「新對話」按鈕      ← 結束當前 session → 歸檔 → 清空
│   ├── session 清單下拉    ← 可回顧過去的 Dashboard Chat sessions
│   └── session 標題顯示    ← 當前 session 的自動命名
├── input-bar.tsx           ← 已有
├── message-bubble.tsx      ← 已完成 markdown（M3）
├── message-list.tsx        ← 已有
├── command-preview.tsx     ← 新增：當 Claude 建議執行動作時，顯示預覽+確認按鈕
└── session-sidebar.tsx     ← 新增：Chat session 歷史列表
```

### 10.5 Session Type 總覽（更新）

| session-type | 來源 | 說明 |
|-------------|------|------|
| `dev` | Claude Code terminal | 開發 CycloneOS 本身 |
| `work` | Claude Code terminal | 用 CycloneOS 做事 |
| `dashboard-chat` | Dashboard Chat panel | Dashboard 上的對話+指令執行 |
| （auto-generated） | SessionEnd hook | 自動產生，被 session-reader 過濾 |

---

## 11. 實作分期

| 階段 | 內容 | 預估複雜度 | 依賴 |
|------|------|-----------|------|
| **M3.5** | Provider 抽象層 + config 系統 + Drive Panel（雙帳號瀏覽搜尋 CRUD）+ SidebarPage 重構 + dashboard-panel 改用 component map | 中 | 無 |
| **M4** | Gmail Panel（收件概覽 + 搜尋 + 讀取 + 草稿 + AI 分類建議） | 中 | Gmail MCP |
| **M4.5** | Chat 強化（Command Router + Session 管理 + 歸檔到 Obsidian） | 中 | M3.5（需要 API routes 作為 command target） |
| **M5** | Document Pipeline（上傳 → OCR → 批次總覽 → 按鈕選擇 → 多格式產出） | 高 | Claude Vision + python-docx/pptx |
| **M6** | OpenClaw skills（mail-classifier + doc-filler + doc-pipeline 背景監控） | 中 | M4 + M5 完成 |
| **M7** | gws 整合 — 插入 GwsDriveProvider + GoogleDocsProvider（需要時再做） | 低 | gws CLI 安裝 |

每個 Milestone 獨立可交付、獨立可測試。

---

## 11. 待釐清項目

1. ~~**Gmail label modify**~~ → **已確認：Gmail MCP 無此工具**，AI 分類改為「建議 only」模式（見 Section 4.1）
2. **python-docx / python-pptx 環境** — Dashboard Mac 是否已有 Python 環境？需確認。Mac Mini (OpenClaw) 應該已有。
3. **PDF 轉圖片** — 需要 `pdf2image` (Python) 或類似工具將 PDF 各頁轉成圖片再送 Claude Vision。或者直接用 Claude API 的 PDF 讀取功能（Opus 4.6 支援）。需確認哪種方式效果更好。
4. ~~**批次暫存清理**~~ → **已決定：** `~/.cycloneos/pipeline/` 下超過 7 天的批次由 cron 自動清理（見 Section 6.7）
5. **同事共編資料夾** — 學校帳號中與同事共編的資料夾路徑，是否需要在 config 中特別標記或加寫入保護？
6. **Gmail 雙帳號** — 目前 Gmail MCP 只連線個人帳號，學校帳號郵件的存取方式待定（M7 或等 MCP 支援多帳號）
7. **Dashboard search vs Drive search** — 現有 "Search" 頁面未來是否擴展為跨源搜尋（Drive + Obsidian + Gmail），還是維持獨立功能？
