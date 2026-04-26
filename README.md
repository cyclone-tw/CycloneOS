# CycloneOS Dashboard

> Personal AI Operating Dashboard / 個人 AI 工作中樞<br>
> Next.js 16 + React 19 + TypeScript + local-first integrations

CycloneOS 是一個以「個人工作流」為核心的 Next.js Dashboard。它把 Gmail、Google Drive、Obsidian、Notion、AI Agent、文件處理、簡報生成、YouTube 轉錄、教育行政與社群發文整合在同一個介面，適合在自己的 Mac / Mac mini 上常駐運行。

本專案偏向 local-first：許多功能會直接讀寫本機掛載的 Google Drive、Obsidian Vault，以及本機 CLI agent，因此建議以 Node.js server 方式部署，不適合純 static export。

## Environment Boundary

- Dashboard 主專案在本機開發與建置，入口是 `src/app/page.tsx`。
- `discord-bot/` 是獨立 runtime target，不屬於 MacBook dashboard build boundary。
- Discord bot 預設跑在 Mac mini，請在 Mac mini 用 Bun 驗證。
- MacBook 上缺少 `bun-types` 或 Bun-only dependencies 時，不應視為 dashboard 專案失敗。

## Features

### 1. Dashboard Shell

- 左側 Sidebar：`Overview`、`Gmail`、`Drive`、`Documents` shortcut、`Skills`、`Timeline`。
- 中央 Dashboard Panel：依目前頁面載入對應工作區。
- 右側 Chat Panel：可同時操作多個 AI agent session。
- 支援 responsive layout 與 mobile bottom navigation。

### 2. Overview

Overview 是日常狀態總覽，包含：

- Stats cards
- Upcoming panel
- Daily digest / Weekly digest
- Mail digest
- YouTube notes digest
- OpenClaw feed
- Session feed
- Activity timeline

### 3. Gmail 工作區

Gmail panel 透過 Google API 提供：

- 郵件列表與 thread 檢視
- 附件讀取
- 標籤管理
- 封存、已讀標記
- 草稿建立
- AI 分類輔助

### 4. Drive 工作區

Drive panel 使用本機 Google Drive 掛載路徑作為 storage provider，而不是直接走 Drive API。

支援：

- 個人 / 學校帳號切換
- 檔案列表、搜尋、讀取
- 建立資料夾
- 複製、移動、刪除
- 圖片與 Google native file URL 輔助開啟

路徑由 `src/config/accounts.ts` 與 `src/config/paths-config.ts` 管理。

### 5. Skills 工作站

Skills 是 CycloneOS 的核心 automation area，目前有 7 個工作站：

| 工作站 | 功能摘要 | 主要 API |
| --- | --- | --- |
| Documents | 多來源檔案讀取、AI 摘要/整理、輸出 MD/DOCX/HTML/XLSX | `/api/documents/process` |
| Presentations | 從檔案、URL、研究內容生成簡報，支援 slide templates、theme、GitHub Pages push | `/api/presentations/generate` |
| Felo AI | SuperAgent 對話、Deep Research、web fetch、AI image | `/api/felo/chat` |
| 公文處理 | 公文掃描、分析、分類歸檔規劃區 | placeholder |
| Education | 特推會 SPC meeting、委員名冊、歷史紀錄、會議稿產生 | `/api/education/*` |
| Transcribe | YouTube / 錄音轉逐字稿，後續可寫入 Notion / Obsidian | `/api/transcribe/*` |
| Social | 素材轉 FB / IG / LINE / 學校網站 / Notion 貼文 | `/api/social/*` |

### 6. Agent Chat

右側 Chat panel 可啟動不同用途的 agent：

- `General`：通用助理
- `Researcher`：搜尋 Obsidian + web，產出研究摘要
- `Writer`：文件與文章撰寫
- `Coder`：程式開發
- `Reviewer`：git diff / PR review
- `Tester`：測試執行與失敗分析

Agent provider 預設可走 `claude` CLI，也可用 `codex`。健康狀態可透過 `/api/health` 檢查。

### 7. Slide Engine

簡報系統包含多種 slide templates，例如：

- cover
- content
- two-column
- comparison
- dataviz
- icon-grid
- image-showcase
- story-cards
- quote
- statement
- section-divider
- closing

設計重點是 content fidelity：簡報內容必須來自輸入 source，不任意編造資料。

## Tech Stack

- Framework: Next.js 16.2.1 App Router
- UI: React 19.2.4, Tailwind CSS 4, shadcn-style components, Lucide icons
- Language: TypeScript
- State: Zustand
- API: Next.js Route Handlers under `src/app/api`
- Storage: local Google Drive mount, Obsidian Vault, Notion API, SQLite via `better-sqlite3`
- AI / LLM: Claude CLI, Codex CLI, optional OpenAI SDK
- Document tools: `html-to-docx`, `exceljs`, Markdown converters

Next.js 16 requires Node.js 20.9+ according to the bundled Next.js docs.

## Project Structure

```txt
src/app/                         Next.js app shell and API routes
src/components/layout/           Sidebar, resizable layout, dashboard panel
src/components/chat/             Agent chat UI
src/components/overview/         Overview widgets
src/components/gmail/            Gmail UI
src/components/drive/            Drive browser UI
src/components/skills/           Skills cards and workstation UIs
src/config/                      Accounts, paths, skill definitions
src/lib/                         Providers, agent bridge, slide engine, integrations
src/stores/                      Zustand stores
scripts/                         Utility scripts
docs/                            Architecture, specs, implementation notes
discord-bot/                     Separate Mac mini Discord bot target
```

## Requirements

- macOS recommended
- Node.js `>= 20.9`
- npm
- Google Drive for desktop, if using Drive / Obsidian integrations
- Claude Code CLI or Codex CLI, if using Agent Chat / AI workstations
- Optional: Notion integration token, Felo API key, Gmail OAuth refresh token
- Optional for presentation PDF sources: `pdftotext` from Poppler

## Quick Start

```bash
npm install
cp .env.example .env.local
npm run dev
```

開啟：

```txt
http://localhost:3000
```

檢查 CLI agent 狀態：

```txt
http://localhost:3000/api/health
```

常用 scripts：

```bash
npm run dev      # Development server
npm run build    # Production build
npm run start    # Production server
npm run lint     # ESLint
```

## Environment Variables

請從 `.env.example` 複製成 `.env.local` 後填入需要的值。

### Google Drive

```env
GOOGLE_DRIVE_EMAIL_PERSONAL=your-email@gmail.com
GOOGLE_DRIVE_EMAIL_SCHOOL=your-email@school.edu.tw
NEXT_PUBLIC_GDRIVE_EMAIL=your-email@gmail.com
```

Google Drive 本機路徑預設為：

```txt
~/Library/CloudStorage/GoogleDrive-{email}/我的雲端硬碟
```

CycloneOS 會在其中使用：

```txt
CycloneOS/
Obsidian-Cyclone/
```

### LLM Provider

```env
LLM_PROVIDER=claude
# or
LLM_PROVIDER=codex

CODEX_MODEL=gpt-5
CODEX_MODEL_OPUS=gpt-5
CODEX_MODEL_SONNET=gpt-5
CODEX_MODEL_HAIKU=gpt-5-mini
```

如果使用 OpenAI SDK：

```env
OPENAI_API_KEY=
OPENAI_MODEL=
```

### Gmail

```env
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GMAIL_REFRESH_TOKEN=
GEMINI_API_KEY=
```

可用 `scripts/get-gmail-token.mjs` 協助取得 Gmail refresh token。

### Notion

```env
NOTION_API_KEY=
NOTION_CY_TASK_DATABASE_ID=
NOTION_TASKS_DB_ID=
NOTION_SOCIAL_DATABASE_ID=
NOTION_YT_NOTES_DATABASE_ID=
```

### Felo

```env
FELO_API_KEY=
FELO_API_BASE=https://openapi.felo.ai
```

### GitHub

```env
GITHUB_TOKEN=
```

用於簡報推送到 GitHub Pages / repository workflow。

## Usage

### 基本操作

1. 進入 `Overview` 查看每日摘要、郵件、session 與近期活動。
2. 進入 `Gmail` 管理郵件與草稿。
3. 進入 `Drive` 瀏覽本機掛載的 Google Drive 檔案。
4. 進入 `Skills` 選擇工作站，例如 Documents、Presentations、Education。
5. 使用右側 `Chat` 開啟 agent，依工作類型選 General / Researcher / Coder 等。

### Documents 工作站

1. 選擇檔案或資料夾作為 source。
2. 輸入需求，例如「整理成會議紀錄」、「摘要重點」、「轉成表格」。
3. 選擇輸出格式：Markdown、DOCX、HTML-to-PDF、XLSX。
4. Markdown 會輸出到 Obsidian outputs；二進位檔案可輸出到指定 Google Drive path。

### Presentations 工作站

1. 加入檔案、URL 或研究文字。
2. 選擇 theme 與 renderer。
3. 生成 outline 後可調整 slide layout 與欄位。
4. 可輸出靜態簡報檔案或推送到 GitHub repository。

### Social 工作站

1. 輸入素材文字，或透過 QMD / Obsidian search 找內容。
2. 選擇平台與 tone。
3. 生成多平台貼文。
4. 可發布或保存到 Notion social database。

### Education 工作站

支援特推會場景：

- 委員名冊管理
- 載入歷史決議
- 產生會議草稿
- 保存 draft
- 輸出正式會議紀錄

相關檔案路徑由 `src/lib/education/obsidian-paths.ts` 控制。

## Deployment

### Local Production

```bash
npm run build
npm run start
```

預設服務位置：

```txt
http://localhost:3000
```

Next.js 官方部署文件指出，Node.js server deployment 支援完整 Next.js 功能。CycloneOS 使用 route handlers、本機檔案系統、CLI process spawn 與 `better-sqlite3`，因此建議使用 Node.js server。

### Mac mini 常駐部署建議

1. 在 Mac mini 安裝 Node.js 20.9+、npm、Claude/Codex CLI。
2. 確認 Google Drive for desktop 已登入並完成同步。
3. 建立 `.env.local`。
4. 執行：

```bash
npm install
npm run build
npm run start
```

5. 如需跨裝置存取，可用 Tailscale Serve / reverse proxy 對外提供 localhost port。

### 不建議的部署方式

- Static export：不支援本專案需要的 server features。
- 純 Vercel serverless：會缺少本機 Google Drive、Obsidian、CLI agent、長時間串流與部分 native package 假設。
- Docker：可行，但需要額外處理 Google Drive mount、Obsidian path、CLI auth、native dependencies。

## Validation

Dashboard 驗證：

```bash
npm run lint
npm run build
```

Health check：

```bash
curl -s http://localhost:3000/api/health
```

Drive 功能驗證：

- 確認 `GOOGLE_DRIVE_EMAIL_PERSONAL` / `GOOGLE_DRIVE_EMAIL_SCHOOL` 與本機 Google Drive folder 名稱一致。
- 確認 `~/Library/CloudStorage/GoogleDrive-{email}/我的雲端硬碟` 存在。

Agent 功能驗證：

```bash
claude --version
codex --version
```

`/api/health` 會回報 `claude` 與 `codex` provider 是否可用。

## Discord Bot

`discord-bot/` 是獨立目標，請不要把它當成 dashboard build 的一部分。

- Runtime: Mac mini
- Package manager/runtime: Bun
- 文件：`docs/discord-bot-setup.md`
- 啟動腳本：`scripts/discord-bot.sh`、`scripts/discord-bot-run.sh`

MacBook dashboard 建置時若 Discord bot dependencies 不完整，通常可以忽略。

## Troubleshooting

### `FELO_API_KEY not configured`

Felo 工作站需要：

```env
FELO_API_KEY=
```

### Gmail 顯示需要 OAuth 設定

確認：

```env
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GMAIL_REFRESH_TOKEN=
```

### Drive 找不到檔案

確認 Google Drive email 與本機 folder name 一致，並確認雲端檔案已下載或可被 Google Drive for desktop 串流讀取。

### Agent Chat 沒反應

先看 health endpoint：

```txt
/api/health
```

再確認 CLI：

```bash
claude --version
codex --version
```

若 provider 設為 `codex`，請確認 `LLM_PROVIDER=codex` 或 `AGENT_CLI_PROVIDER=codex`。

### PDF source 讀取失敗

簡報工作站讀 PDF 時可能使用 `pdftotext`。macOS 可用：

```bash
brew install poppler
```

## Notes for Developers

- Next.js 版本是 16.x，本 repo 的 `AGENTS.md` 要求寫 code 前先查 `node_modules/next/dist/docs/`。
- API routes 主要在 `src/app/api/`，多數 AI route 使用 SSE streaming。
- LLM abstraction 在 `src/lib/llm-provider.ts`。
- Chat CLI bridge 在 `src/lib/claude-bridge.ts`。
- 輸出路徑集中在 `src/config/paths-config.ts`。
- 不要在 README 或 commit 中放入 `.env.local` 的 secret。
