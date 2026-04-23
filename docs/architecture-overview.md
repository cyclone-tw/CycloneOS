# CycloneOS 架構總覽

---

# Part 1: CycloneOS Dashboard

## 簡要概述

CycloneOS 是一個 Next.js 個人 Dashboard，左側 Sidebar 有 Overview、Gmail、Drive、Skills、Timeline 五大區。Skills 頁面提供 7 個「工作站」（文件、簡報、Felo AI、公文、教育、語音轉錄、社群發文），各自透過 API routes 串接外部服務。右側 Chat 面板可選 6 種 AI Agent。Discord Bot 為獨立常駐服務。

## 詳細解說

### 1. 技術棧

- **框架**：Next.js 16 + React 19 + TypeScript
- **狀態管理**：Zustand（8 個 store）
- **UI**：Tailwind CSS 4 + shadcn/ui + Lucide icons
- **後端 API**：Next.js Route Handlers（`src/app/api/`）
- **資料儲存**：Better-SQLite3（本地）、Google Drive（雲端）、Obsidian Vault（Markdown）
- **部署**：Mac Mini 常駐，Tailscale Serve（port 8445）跨裝置存取

### 2. Dashboard 架構（頁面層）

```
Sidebar（左）         │  主面板（中）          │  Chat 面板（右）
─────────────────────┼──────────────────────┼────────────────
Overview             │  對應頁面內容          │  Agent 多分頁
Gmail                │                      │  6 種 Agent 可選
Drive                │                      │
Skills → 工作站      │                      │
Timeline             │                      │
```

**Overview** 包含：Stats Cards、Daily/Weekly Digest、Mail Digest、Sessions Feed、OpenClaw Feed、YT Digest、Activity Timeline、Upcoming Panel

### 3. Skills 工作站（核心功能區）

每個工作站是一個獨立的全功能介面，有自己的 UI 元件和 API routes：

| 工作站 | 功能 | 關鍵 API |
|--------|------|---------|
| **Documents** | 多源讀取 → AI 加工 → DOCX/PDF/XLSX/MD 輸出 | `/api/documents/process`, `/api/documents/browse` |
| **Presentations** | AI 簡報生成、13 種 slide template、theme、push to GitHub | `/api/presentations/generate`, `/api/presentations/push-github` |
| **Felo AI** | SuperAgent 對話、AI 生圖、Web Fetch、Deep Research | `/api/felo/chat`, `/api/felo/export` |
| **公文處理** | 公文掃描→AI 分析→分類歸檔 | （placeholder） |
| **Education** | 特推會（SPC Meeting）記錄生成、委員管理、IEP | `/api/education/spc-meeting/*`, `/api/education/committee/*` |
| **Transcribe** | YouTube 影片 / 錄音 → Whisper 逐字稿 | `/api/transcribe/youtube`, `/api/transcribe/status` |
| **Social** | 素材 → FB/IG/LINE/學校網站/Notion 貼文生成 | `/api/social/generate`, `/api/social/publish-notion` |

### 4. Chat / Agent 系統

右側 Chat 面板可開多個 Agent 分頁，每個 Agent 是一個獨立的 Claude Code instance（透過 `child_process` spawn）：

| Agent | Model | 用途 |
|-------|-------|------|
| **General** | Sonnet | 通用對話 |
| **Researcher** | Opus | 搜尋 Obsidian + web，產研究摘要 |
| **Writer** | Opus | 撰寫文件、文章 |
| **Coder** | Sonnet | 寫/改程式碼 |
| **Reviewer** | Sonnet | 審查 git diff / PR |
| **Tester** | Sonnet | 跑測試、分析失敗 |

Agent 可存取 Obsidian Vault 作為知識庫（`contextDirs`）。

### 5. 整合服務

| 整合 | 機制 |
|------|------|
| **Gmail** | Google API → 收信/讀信/分類/歸檔/草稿/附件 |
| **Google Drive** | StorageProvider 抽象層 → 本地掛載的 Google Drive 目錄 |
| **Obsidian Vault** | 直接讀寫 Markdown，作為知識庫和輸出目標 |
| **Notion** | API → 任務管理、YT 筆記、社群發文 |
| **Felo AI** | API → SuperAgent、生圖、Web Fetch |
| **Discord** | 獨立 Bot（見 Part 2） |
| **QMD** | MCP server → Obsidian 語意搜尋 |

### 6. 路徑架構

所有輸出路徑統一在 `src/config/paths-config.ts` 管理：

- **Markdown 輸出** → Obsidian Vault（`CycloneOS/outputs/`）
- **二進位檔案（DOCX/XLSX）** → Google Drive（`CycloneOS/documents/`）
- **圖片** → Google Drive（`CycloneOS/images/`）
- **簡報** → Google Drive（`CycloneOS/slides/`）+ GitHub Pages

### 7. 設計原則

- **AI Agent 無關性**：LLM 呼叫走抽象層（`src/lib/llm-provider.ts`），prompt 與邏輯分離，不綁死特定 AI
- **Prompt 與邏輯分離**：prompt template 可獨立替換
- **外部 API 獨立封裝**：各服務封裝在 `lib/` 模組，與 AI 層解耦

### 8. Claude Code Skills（開發工具鏈）

專案內 `.claude/commands/` 定義了 3 個 slash command：
- `/session-log` — 產生 session 紀錄
- `/handoff` — 產生下次 session 的 handoff prompt
- `/changelog` — 更新 CHANGELOG

另外搭配 Superpowers 插件的 brainstorm → write-plan → execute-plan 工作流進行功能開發。

---

# Part 2: Discord Bot

## 簡要概述

Bot 透過 tmux while-loop 常駐執行 `claude --channels plugin:discord`，crash 後 2 秒自動重啟。Session 在 conversation context 中追蹤訊息數與任務日誌。Bot 使用 `--dangerously-skip-permissions` 跑在獨立目錄 `~/discord-bot/`，能力邊界等同 Claude Code 本身——能讀寫檔案、跑指令、寫 Obsidian，但受限於 CLAUDE.md 的行為規則。

## 詳細解說

### 1. 啟動機制

`scripts/discord-bot.sh` 做三件事：

1. **準備工作目錄** — 建立 `~/discord-bot/`，從 repo 複製最新的 `discord-bot/CLAUDE.md` 進去
2. **清除舊 session** — `tmux kill-session -t discord-bot` 確保不會重複
3. **啟動 tmux + while-loop** — 在 tmux session `discord-bot` 內跑無限迴圈：

```bash
while true; do
  claude --channels plugin:discord@claude-plugins-official \
    --dangerously-skip-permissions --model sonnet
  sleep 2  # exit 後 2 秒重啟
done
```

Bot 本質上就是一個 Claude Code instance，透過 Discord plugin 接收/回覆訊息，model 固定用 Sonnet。

### 2. Session 管理

Bot **沒有持久化的 session 狀態**，所有追蹤都在 Claude 的 conversation context 中：

| 追蹤項目 | 說明 |
|---------|------|
| 啟動時間 | 收到第一則訊息時記錄 |
| 訊息計數 | 每處理一則 Discord 訊息 +1 |
| 任務日誌 | `{時間, 來源, 摘要, ✅/❌}` |

三個指令控制 session 生命週期：

- **`/context`** — 回報運行時間、訊息數、任務摘要、token 用量
- **`/session-log`** — 將追蹤紀錄寫入 Obsidian（`Discord/bot-logs/YYYY-MM-DD-bot-NN.md`），不重啟
- **`/new`** — 寫日誌 → 追加 handoff → 通知 Discord → `/exit` 結束（while-loop 自動重啟新 session）

Session 重啟 = context 歸零，但日誌已持久化到 Obsidian。

### 3. 執行邊界

**能力上限：**

- `--dangerously-skip-permissions` 意味著 Bot 可以執行**任何** shell 指令、讀寫任何檔案，不需使用者確認
- 工作目錄是 `~/discord-bot/`（與 CycloneOS repo 隔離）
- 能寫入 Obsidian Vault（透過 Glob + Write 工具）

**行為限制（由 CLAUDE.md 軟約束）：**

- 只用繁體中文回覆
- 簡單問題直接答，不過度研究
- 失敗要說明原因
- 寫 Obsidian 時禁止用 Bash `ls`/`find`，只能用 Glob + Write
- 收到訊息自動加 👀，完成後加 ✅ 或 ❌

**關鍵風險：** `--dangerously-skip-permissions` 讓 Bot 的技術邊界基本等同 root 權限的 Claude Code，安全邊界完全依賴 CLAUDE.md 的軟性規則和 model 的指令遵從能力。
