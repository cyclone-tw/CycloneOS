---
type: design-spec
date: 2026-03-24
tags: [cycloneos, dashboard, chat, claude-code, agent-sdk, phase1]
---

# CycloneOS Dashboard — AI 工作站設計規格

## 1. 願景

將 CycloneOS Dashboard 從被動監控面板提升為 **主動互動式 AI 工作站**：使用者可以在同一個介面中查看系統狀態、對話下達指令、讀取多來源資料、編修/生成檔案，並且接續歷史 Session 繼續工作。

核心原則：
- **Chat-integrated** — 對話不是附加功能，是核心操作介面
- **Zero-friction** — 預設 acceptEdits 權限模式，不需反覆確認
- **Multi-source** — 統一介面存取 Obsidian、Notion、Gmail、Google Drive、GitHub
- **Resumable** — Session 可接續，context 不丟失

## 2. 使用者背景

- 特教資源班教師 + 資訊業務承辦人 + 進修部主任
- 業務含大量會議、公文、教材、行政表單
- 已有 OpenClaw 跑在 Mac Mini（24/7 cron、Discord）
- 這台 Mac（cyclone）為 Claude Code 主力工作環境
- 每日早上需要概覽待辦 + 工作中即時互動

## 3. 技術架構

### 3.1 整體架構

```
┌────────────────────────────────────────────────────────────────┐
│                    Browser (localhost:3000)                      │
│                                                                  │
│  ┌──────┐ ┌────────────────────┐ ┌──────────────────────────┐  │
│  │ Icon │ │   Dashboard Panel  │ │     Chat Panel           │  │
│  │ Side │ │                    │ │                           │  │
│  │ bar  │ │  Stats Cards       │ │  Message History         │  │
│  │      │ │  Activity Timeline │ │  Streaming Response      │  │
│  │  56px│ │  Notion Tasks      │ │  File Preview            │  │
│  │      │ │  Calendar          │ │  Session Selector        │  │
│  │      │ │  OpenClaw Status   │ │                           │  │
│  │      │ │                    │ │  [________________] Send  │  │
│  └──────┘ └────────────────────┘ └──────────────────────────┘  │
│            ◄─── 可拖曳寬度 ───►   ◄─── 可拖曳寬度 ───►         │
│                    Responsive Layout                             │
└────────────────────────┬───────────────────────────────────────┘
                         │ WebSocket
┌────────────────────────▼───────────────────────────────────────┐
│                  Next.js Server (API Routes)                     │
│                                                                  │
│  /api/chat      → spawn claude CLI subprocess                    │
│  /api/sessions  → list/resume sessions                           │
│  /api/notion    → Notion API proxy                               │
│  /api/gmail     → Gmail API proxy                                │
│  /api/drive     → Google Drive API proxy                         │
│  /api/github    → GitHub API proxy                               │
│  /api/groq      → Groq API proxy                                 │
│  /api/brave     → Brave Search API proxy                         │
│  /api/apify     → Apify API proxy                                │
│  /api/felo      → Felo API proxy                                 │
│  /api/obsidian  → 本地 vault 檔案讀取                             │
│  /api/audit     → audit.jsonl 讀取                                │
│  /api/openclaw  → Obsidian Draco/ cron 產出讀取                   │
└────────────────────────┬───────────────────────────────────────┘
                         │
          ┌──────────────┼──────────────┐
          ▼              ▼              ▼
   claude CLI      External APIs   Local Filesystem
   (subprocess)    (Notion/Gmail/   (~/.cyclone/,
                    Drive/GitHub/    Obsidian vault)
                    Groq/Brave/
                    Apify/Felo)
```

### 3.2 核心技術選擇

| 元件 | 技術 | 原因 |
|------|------|------|
| 前端框架 | Next.js 15 (App Router) | SSR + API Routes 一體化 |
| UI 元件 | shadcn/ui + Tailwind CSS | 暗色主題友好，元件可客製 |
| 可拖曳面板 | react-resizable-panels | 輕量、穩定、支援持久化寬度 |
| 即時通訊 | WebSocket (ws) | Chat 串流需要雙向即時連線 |
| Claude 整合 | CLI Subprocess (spawn) | 用 Max plan 額度，不花 API 錢 |
| Markdown 渲染 | react-markdown + rehype | 支援 GFM + 語法高亮 |
| 語法高亮 | shiki | VSCode 等級的語法高亮 |
| 狀態管理 | zustand | 輕量、不需 provider wrapper |
| 圖表 | recharts (可選) | 簡單的統計視覺化 |

### 3.3 Claude CLI Subprocess 架構

```
Browser  ──SSE stream──►  Next.js Server  ──spawn──►  claude CLI
         ◄──────────────  (App Router)     ◄──────────  (per-message)
         ──POST message─►

                              spawn options:
                              { cwd: '/Users/username/CycloneOpenClaw' }

                              CLI flags:
                              --print --verbose
                              --output-format stream-json
                              --permission-mode acceptEdits
                              --resume <session-id> (optional)
                              --add-dir <vault-path>

                              ▼
                         Parse JSON lines from stdout
                         Stream to browser via SSE
```

**通訊架構：**
- **SSE (Server-Sent Events)** 用於 server→client 串流回應（Next.js App Router 原生支援）
- **POST /api/chat** 用於 client→server 發送使用者訊息
- 不使用 WebSocket（App Router 不原生支援，SSE 足以覆蓋需求）

**CLI 執行模式：**
- 每則訊息 spawn 一個新的 `claude --print` process（單次執行模式）
- 透過 `--resume <session-id>` 保持對話 context 連續性
- 未來可考慮改用 `--input-format stream-json --output-format stream-json` 做長駐 process

**權限模式：**
- 預設：`acceptEdits` — 檔案讀寫自動執行，不需確認
- 可切換：`bypassPermissions` — 全自動（含 Bash），需二次確認才能啟用
- 只有 `rm`、`git push` 等危險操作才會暫停等確認
- 前端提供模式切換開關（bypassPermissions 切換需確認 dialog）

**CLI 呼叫方式：**
```bash
claude --print --verbose --output-format stream-json \
  --permission-mode acceptEdits \
  --resume <session-id> \
  --add-dir "${VAULT}" \
  "user prompt here"
```

> **注意：** 不使用 `--cwd`（此 flag 不存在）。改用 `child_process.spawn()` 的 `{ cwd }` 選項設定工作目錄。`--verbose` 是 `stream-json` 格式的必要搭配。

**錯誤處理：**

| 情境 | 處理方式 |
|------|---------|
| CLI 未安裝 | 啟動時健康檢查，顯示安裝指引 |
| CLI 未認證 | 偵測 stderr 認證錯誤，引導使用者執行 `claude login` |
| Process crash | 偵測 exit code，顯示錯誤訊息，可重試 |
| 回應超時 | 60 秒無 stdout 輸出則判定超時，通知使用者 |
| 使用者送新訊息時仍在回應 | 顯示「忙碌中」狀態，排隊等待當前回應完成 |

### 3.4 Session 管理

| 功能 | 實作方式 |
|------|---------|
| 列出歷史 session | 讀取 `~/.claude/projects/` 目錄結構 + Dashboard 自建 session index |
| 接續 session | `claude --print --resume <session-id>` |
| 新建 session | 不帶 --resume 即自動新建 |
| Session 標題 | (1) 使用者自訂 → (2) 第一則訊息前 50 字 → (3) 日期+序號 |

> **注意：** `claude sessions list` 為互動式命令，不適合程式化呼叫。改用讀取 `~/.claude/` 內部儲存 + Dashboard 自建 JSON index (`~/.cyclone/data/session-index.json`) 雙軌方式。每次新建/接續 session 時同步更新 index。

前端 Session Selector：
- Chat 面板頂部放 session 選擇器
- 顯示最近 10 個 session（日期 + 標題摘要）
- 點擊即可切換/接續
- 支援搜尋歷史 session

## 4. 佈局設計

### 4.1 三欄結構

```
┌──────┬─────────────────────────┬──────────────────────┐
│ 56px │     可變寬度（預設 60%） │   可變寬度（預設 40%）│
│      │                         │                      │
│ Icon │    Dashboard Panel      │    Chat Panel        │
│ Side │                         │                      │
│ bar  │                         │                      │
│      │                         │                      │
│      │    ◄── drag handle ──►  │                      │
│      │                         │                      │
└──────┴─────────────────────────┴──────────────────────┘
```

- **Icon Sidebar (56px 固定)**：導航圖示（Overview, Tasks, Calendar, Files, Settings）
- **Dashboard Panel (可變)**：主內容區，根據側邊欄選擇切換頁面
- **Chat Panel (可變)**：對話窗口，永遠可見
- **Drag Handle**：兩個面板之間可拖曳調整寬度
- **寬度持久化**：用 localStorage 記住使用者偏好

### 4.2 響應式斷點

| 螢幕寬度 | 行為 |
|---------|------|
| ≥ 1280px | 三欄同時顯示 |
| 768–1279px | 側邊欄 + 一欄，Chat 用 overlay/drawer 切換 |
| < 768px | （低優先）單欄 + 底部 tab，使用者為桌面環境，延後處理 |

### 4.3 Icon Sidebar 內容

| 圖示 | 頁面 | 說明 |
|------|------|------|
| 🏠 | Overview | 統計卡片 + 活動時間軸 |
| 📋 | Tasks | Notion CY Task v2 看板 |
| 📅 | Calendar | 今日/本週行程 |
| 📁 | Files | 本地 + Google Drive 檔案瀏覽 |
| 🔍 | Search | 跨來源全文搜尋 |
| ⚙️ | Settings | 模式切換、API 狀態、連線設定 |

## 5. 資料來源整合

### 5.1 本地資料

| 來源 | 路徑 | 用途 |
|------|------|------|
| Obsidian vault (CycloneOS) | `${VAULT}/CycloneOS/` | Session logs, knowledge index |
| Obsidian vault (Draco/cron) | `${VAULT}/Draco/cron/` | OpenClaw daily output |
| Audit log | `~/.cyclone/logs/audit.jsonl` | 操作記錄時間軸 |
| Config | `~/.cyclone/config.json` | 系統設定 |

`VAULT` = `~/Library/CloudStorage/GoogleDrive-user@gmail.com/我的雲端硬碟/Obsidian-Cyclone`

### 5.2 雲端 API

| 服務 | 用途 | 認證方式 | .env key |
|------|------|---------|----------|
| Notion | CY Task v2 任務管理、筆記搜尋 | Integration Token | `NOTION_TOKEN` |
| Gmail | 郵件搜尋、讀信 | OAuth2 | `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN` |
| Google Drive (個人) | user@gmail.com 雲端硬碟 | OAuth2 (共用 Gmail token) | 同上 |
| Google Drive (學校) | cyclonetw@ksps.ntct.edu.tw 雲端硬碟 | OAuth2 | `SCHOOL_GMAIL_CLIENT_ID`, `SCHOOL_GMAIL_CLIENT_SECRET`, `SCHOOL_GMAIL_REFRESH_TOKEN` |
| GitHub | 讀取 repo 內容、issues、PRs | Personal Access Token | `GITHUB_TOKEN` |
| Groq | 快速 LLM 推理（輕量任務分流） | API Key | `GROQ_API_KEY` |
| Brave Search | 網路搜尋 | API Key | `BRAVE_API_KEY` |
| Apify | 網頁爬蟲 / 資料擷取 | API Key | `APIFY_API_KEY` |
| Felo | 搜尋 / 簡報素材 | API Key | `FELO_API_KEY` |

### 5.3 Google Drive 存取範圍控制

- 使用者在 Settings 頁面指定每個帳號可存取的資料夾路徑
- Chat 只在指定範圍內讀取，不會亂翻
- 預設範圍：
  - 個人：`我的雲端硬碟/Obsidian-Cyclone/`
  - 學校：`我的雲端硬碟/` (使用者可限縮)

### 5.4 .env 檔案結構

```env
# === Claude / AI ===
# (不需要 — 用 Max plan 透過 CLI)

# === Notion ===
NOTION_TOKEN=ntn_xxx
NOTION_TASKS_DB_ID=1803047f-3820-4a10-ab23-ef79ab5d6957

# === Gmail + Google Drive (個人) ===
GMAIL_CLIENT_ID=xxx.apps.googleusercontent.com
GMAIL_CLIENT_SECRET=xxx
GMAIL_REFRESH_TOKEN=xxx

# === Gmail + Google Drive (學校) ===
SCHOOL_GMAIL_CLIENT_ID=xxx.apps.googleusercontent.com
SCHOOL_GMAIL_CLIENT_SECRET=xxx
SCHOOL_GMAIL_REFRESH_TOKEN=xxx

# === GitHub ===
GITHUB_TOKEN=ghp_xxx

# === Search & Research ===
GROQ_API_KEY=gsk_xxx
BRAVE_API_KEY=BSA_xxx
APIFY_API_KEY=apify_api_xxx
FELO_API_KEY=xxx
```

### 5.5 OAuth2 Token 生命週期

Gmail 和 Google Drive 使用 OAuth2 認證，access token 約 1 小時過期：

| 階段 | 處理方式 |
|------|---------|
| 初次設定 | 使用者透過 Google Cloud Console 建立 OAuth Client，執行授權流程取得 refresh token |
| Token 刷新 | server-side client wrapper 自動用 refresh token 換取新 access token |
| Token 快取 | 記憶體快取 access token，過期前 5 分鐘主動刷新 |
| Refresh token 失效 | 偵測 401 錯誤，Settings 頁顯示重新授權按鈕 |
| 多帳號 | 個人/學校帳號各自維護獨立的 token 生命週期 |

### 5.6 Audit.jsonl Schema

每行一個 JSON 物件，格式如下：

```json
{
  "time": "2026-03-24T10:30:15Z",
  "tool": "Bash|Edit|Write",
  "detail": "操作的檔案路徑或指令摘要（最多 200 字）"
}
```

由 PostToolUse hook (`~/.cyclone/scripts/hooks/audit-log.sh`) 自動寫入。

### 5.7 API 呼叫頻率限制

Dashboard 所有 API proxy route 為 localhost-only，不對外暴露。為避免誤觸外部 API 配額：

| 服務 | 限制策略 |
|------|---------|
| Notion | 3 req/sec（官方限制） |
| Gmail/Drive | 遵循 Google API 配額，批次請求合併 |
| GitHub | 5000 req/hour（PAT 限制） |
| Groq/Brave/Apify/Felo | 依各自 free tier 限制，加 in-memory rate limiter |

## 6. Chat Panel 功能規格

### 6.1 MVP 功能（優先）

| # | 功能 | 說明 |
|---|------|------|
| 1 | 基本對話 | 送出 prompt → CLI subprocess → 串流回應 |
| 2 | 讀取 Obsidian | 指定路徑讀取 CycloneOS vault 內容 |
| 3 | 讀取 Notion | 查 CY Task v2、搜尋筆記 |
| 4 | 讀取 Gmail | 搜郵件、讀信 |
| 5 | 檔案編修 | 請 Claude 修改本地檔案 |
| 6 | 檔案生成 | 請 Claude 產生新檔案（報告、教材、簡報等） |
| 7 | Session 接續 | 列出歷史 session，選一個接續 |

### 6.2 後續功能

| # | 功能 | 說明 |
|---|------|------|
| 8 | Markdown 渲染 | 回應支援 GFM markdown 格式 |
| 9 | 語法高亮 | 程式碼區塊用 shiki 渲染 |
| 10 | 檔案預覽 | 對話中提到的檔案可點開預覽（未來） |

### 6.3 Chat UI 元件

```
┌─────────────────────────────────┐
│ Session: 2026-03-24 #2    [▼]  │  ← Session selector
├─────────────────────────────────┤
│                                 │
│  [User avatar]                  │
│  幫我整理今天所有會議的待辦事項    │
│                                 │
│            [CycloneOS avatar]   │
│  已讀取 Notion CY Task v2...    │
│  ┌─────────────────────────┐   │
│  │ 📋 Found 3 meetings     │   │  ← 結構化回應卡片
│  │ ✅ IEP 會議 - 10:00     │   │
│  │ ✅ 特推會 - 14:00       │   │
│  │ ⏳ 陳會 - 16:00         │   │
│  └─────────────────────────┘   │
│                                 │
│  ● Typing...                   │  ← 串流指示器
│                                 │
├─────────────────────────────────┤
│ [acceptEdits ▼] [___________] ↑│  ← 輸入欄 + 權限模式
└─────────────────────────────────┘
```

### 6.4 權限模式切換

| 模式 | 顯示 | 行為 |
|------|------|------|
| `acceptEdits` | 🟢 Auto Edit | 檔案讀寫自動，Bash 需確認 |
| `bypassPermissions` | 🟡 Full Auto | 全自動，不問任何問題 |
| `default` | 🔵 Safe | 所有操作都需確認 |

前端在輸入欄旁顯示當前模式 badge，可點擊切換。

## 7. Dashboard Panel 頁面

### 7.1 Overview 頁

```
┌─────────────────────────────────────┐
│  統計卡片（橫排）                     │
│  ┌────────┐ ┌────────┐ ┌────────┐  │
│  │Tasks 12│ │Today  3│ │Ops   47│  │
│  └────────┘ └────────┘ └────────┘  │
│                                     │
│  Activity Timeline                  │
│  ● 10:30 Edit docs/spec.md         │
│  ● 10:15 Bash: npm install          │
│  ● 09:45 Notion: updated task       │
│  ● 09:30 Session started            │
│                                     │
│  OpenClaw 今日產出                   │
│  📄 2026-03-24-daily-info.md        │
│  📧 2026-03-24-MailReport.md        │
└─────────────────────────────────────┘
```

- Stats Cards：讀 Notion API（任務數）+ audit.jsonl（操作數）+ Calendar（今日事件數）
- Activity Timeline：用 `chokidar` 監聽 audit.jsonl 變更（比輪詢更即時且省資源）
- OpenClaw 產出：讀 Obsidian vault Draco/cron/

### 7.2 Tasks 頁

- 接入 Notion CY Task v2（DB ID: `1803047f-3820-4a10-ab23-ef79ab5d6957`）
- 顯示為看板（Kanban）或列表，依 status 分組
- 可透過 Chat 指令新增/更新任務

### 7.3 Calendar 頁

- 預留 Google Calendar 整合（待 API 接入）
- MVP 階段顯示 Notion 中有日期的任務

### 7.4 Files 頁

- 本地檔案瀏覽器（~/.cyclone/, CycloneOpenClaw repo）
- Google Drive 瀏覽器（兩個帳號，範圍受限）
- 點擊檔案可在 Chat 中引用

### 7.5 Settings 頁

- API 連線狀態（綠/紅燈）
- Google Drive 存取範圍設定
- Chat 權限模式
- 主題設定（預留）

## 8. 品牌與視覺

### 8.1 配色

| Token | 色碼 | 用途 |
|-------|------|------|
| `bg-primary` | `#0F172A` | 主背景（Slate 900） |
| `bg-card` | `#1E293B` | 卡片/面板背景（Slate 800） |
| `bg-input` | `#334155` | 輸入欄、次要區域（Slate 700） |
| `accent` | `#38BDF8` | 強調色、連結、CycloneOS 品牌色 |
| `silver` | `#C0C0C0` | Logo、次要強調 |
| `text` | `#F1F5F9` | 主要文字（Slate 100） |
| `text-muted` | `#94A3B8` | 次要文字（Slate 400） |
| `success` | `#22C55E` | 成功狀態 |
| `error` | `#EF4444` | 錯誤狀態 |
| `warning` | `#F59E0B` | 警告狀態 |

### 8.2 字型

- 標題：Noto Sans TC Bold
- 內文：Noto Sans TC Regular
- 程式碼：JetBrains Mono / Fira Code
- 載入方式：使用 `next/font/google` 載入（避免 layout shift，自動子集化）

### 8.3 設計風格

- 暗色系麥肯錫風格（深色背景 + 清晰數據呈現）
- 卡片圓角 8px，間距 8-16px
- 微妙的邊框和陰影，不用粗重的分隔線
- 動畫克制，只在必要時使用（載入、串流、切換）

## 9. 專案結構

```
CycloneOpenClaw/
└── dashboard/                    # Next.js 專案根目錄
    ├── .env.local                # API keys（gitignored）
    ├── next.config.ts
    ├── tailwind.config.ts
    ├── package.json
    ├── tsconfig.json
    ├── src/
    │   ├── app/
    │   │   ├── layout.tsx        # Root layout（三欄結構）
    │   │   ├── page.tsx          # Overview 頁
    │   │   ├── tasks/page.tsx
    │   │   ├── calendar/page.tsx
    │   │   ├── files/page.tsx
    │   │   ├── settings/page.tsx
    │   │   └── api/
    │   │       ├── chat/route.ts         # WebSocket → claude CLI
    │   │       ├── sessions/route.ts     # Session 列表/恢復
    │   │       ├── notion/route.ts
    │   │       ├── gmail/route.ts
    │   │       ├── drive/route.ts
    │   │       ├── github/route.ts
    │   │       ├── groq/route.ts
    │   │       ├── brave/route.ts
    │   │       ├── apify/route.ts
    │   │       ├── felo/route.ts
    │   │       ├── obsidian/route.ts
    │   │       ├── audit/route.ts
    │   │       └── openclaw/route.ts
    │   ├── components/
    │   │   ├── layout/
    │   │   │   ├── sidebar.tsx           # Icon sidebar
    │   │   │   ├── dashboard-panel.tsx   # 中間面板容器
    │   │   │   ├── chat-panel.tsx        # Chat 面板
    │   │   │   └── resizable-layout.tsx  # 三欄可拖曳佈局
    │   │   ├── chat/
    │   │   │   ├── message-list.tsx      # 訊息列表
    │   │   │   ├── message-bubble.tsx    # 單則訊息
    │   │   │   ├── input-bar.tsx         # 輸入欄
    │   │   │   ├── session-selector.tsx  # Session 切換
    │   │   │   └── permission-badge.tsx  # 權限模式顯示
    │   │   ├── dashboard/
    │   │   │   ├── stats-cards.tsx       # 統計卡片
    │   │   │   ├── activity-timeline.tsx # 活動時間軸
    │   │   │   ├── openclaw-feed.tsx     # OpenClaw 產出
    │   │   │   └── task-board.tsx        # Notion 任務看板
    │   │   └── ui/                       # shadcn/ui 元件
    │   ├── lib/
    │   │   ├── claude-bridge.ts          # CLI subprocess 管理
    │   │   ├── websocket-server.ts       # WebSocket 伺服器
    │   │   ├── notion-client.ts          # Notion API wrapper
    │   │   ├── gmail-client.ts           # Gmail API wrapper
    │   │   ├── drive-client.ts           # Google Drive wrapper
    │   │   ├── github-client.ts          # GitHub API wrapper
    │   │   ├── groq-client.ts            # Groq API wrapper
    │   │   ├── brave-client.ts           # Brave Search wrapper
    │   │   ├── apify-client.ts           # Apify wrapper
    │   │   ├── felo-client.ts            # Felo wrapper
    │   │   ├── obsidian-reader.ts        # Obsidian vault 讀取
    │   │   ├── audit-reader.ts           # audit.jsonl 讀取
    │   │   └── config.ts                 # ~/.cyclone/config.json 讀取
    │   ├── hooks/                        # React hooks
    │   │   ├── use-chat.ts               # Chat 狀態管理
    │   │   ├── use-sessions.ts           # Session 管理
    │   │   └── use-websocket.ts          # WebSocket 連線
    │   ├── stores/                        # zustand stores
    │   │   ├── chat-store.ts
    │   │   └── app-store.ts
    │   └── types/
    │       ├── chat.ts
    │       ├── session.ts
    │       └── api.ts
    └── public/
        └── logo-dragon.png
```

## 10. 安全性

### 10.1 API Key 保護

- 所有 API key 存在 `.env.local`（gitignored）
- 前端永遠不直接接觸 API key
- 所有外部 API 呼叫走 server-side API route

### 10.2 Claude CLI 權限

- 預設 `acceptEdits`：自動允許檔案讀寫
- `bypassPermissions`：全自動模式，使用者主動啟用
- PreToolUse hook 攔截敏感檔案（學生個資、credentials、.env）

### 10.3 Google Drive 範圍限制

- 使用者在 Settings 指定可存取的資料夾
- API route 層級驗證路徑範圍
- 不允許存取範圍外的檔案

### 10.4 本地檔案保護

- 延用現有 PreToolUse hook 的敏感檔案攔截
- Chat 的 claude CLI subprocess 繼承 settings.local.json 的 hook 設定

## 11. 效能考量

| 項目 | 策略 |
|------|------|
| CLI 冷啟動 | 預先 spawn 一個 idle subprocess，收到第一個 prompt 時直接用 |
| Obsidian 讀取 | 快取機制（同 session-start.sh），每日重建一次 |
| Notion 查詢 | 前端 SWR 快取，30 秒 stale-while-revalidate |
| Audit log | `chokidar` 監聽變更，只讀最後 100 筆 |
| Google Drive | 按需載入，目錄結構快取 5 分鐘 |
| WebSocket | 心跳 30 秒，斷線自動重連 |

## 12. 非功能需求

| 需求 | 標準 |
|------|------|
| 首次載入 | < 3 秒 |
| Chat 回應延遲 | < 500ms 到第一個 token |
| 支援瀏覽器 | Chrome, Safari (macOS) |
| 並行 session | 一次只有一個 active CLI subprocess |
| 資料保存 | 所有產出走 Obsidian vault 或本地檔案系統 |

## 13. 開發順序（建議）

### Milestone 1: 骨架 + Chat（核心）
1. Next.js 初始化 + Tailwind + shadcn/ui
2. 三欄可拖曳佈局（react-resizable-panels）
3. Icon Sidebar 導航
4. Chat Panel UI（輸入欄、訊息列表、串流顯示）
5. Claude CLI subprocess bridge（WebSocket）
6. 權限模式切換

### Milestone 2: Dashboard 首頁
7. 統計卡片（讀 audit.jsonl + Notion API）
8. Activity Timeline（audit.jsonl 輪詢）
9. OpenClaw 產出 feed（讀 Obsidian vault）

### Milestone 3: 資料來源接入
10. Notion CY Task v2 看板
11. Gmail 搜尋/讀信
12. Google Drive 瀏覽（兩個帳號）
13. GitHub repo 讀取
14. Obsidian vault 瀏覽

### Milestone 4: 外部 API + Session
15. Groq / Brave / Apify / Felo API route
16. Session 列表 + 接續功能
17. Settings 頁（API 狀態、Drive 範圍、模式切換）

### Milestone 5: 打磨
18. Markdown 渲染 + 語法高亮
19. 響應式斷點
20. 品牌配色微調
