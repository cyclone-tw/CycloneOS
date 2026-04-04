# 語音轉錄工作站 — Phase 1：YouTube 影片處理

> 日期：2026-04-04
> 狀態：已確認

## 概述

將現有「語音轉錄工作站」skill 卡片實作起來，Phase 1 聚焦 YouTube 影片處理功能。使用者透過 Discord Bot 或 Dashboard 貼上 YouTube 連結，系統自動下載音檔、取得/生成逐字稿、產出詳細摘要，並存入 Obsidian 和 Notion。

## 架構

```
觸發入口                    處理層                         輸出層
─────────              ──────────                    ──────────
Discord Bot ──┐
              ├──→ POST /api/transcribe/youtube ──→ 背景 Process
Dashboard UI ─┘         │                              │
                        │ 1. yt-dlp 抓影片資訊+字幕+音檔  │
                        │ 2. 有字幕→直接用；沒有→Whisper   │
                        │ 3. LLM 生成摘要+章節整理         │
                        │ 4. 寫入各目標                    │
                        │                              │
                        ▼                              ▼
                  回傳 jobId              Obsidian（Draco/yt-notes/）
                  前端 polling            Notion（YT 深度研究 DB）
                  完成通知                Dashboard 可瀏覽
```

## 核心流程

1. **接收** — YouTube URL → 驗證連結有效性
2. **下載** — `yt-dlp` 抓取影片 metadata、字幕（原生/自動）、MP3 音檔
3. **轉錄** — 優先用 YouTube 原生/自動字幕，沒有才跑本地 Whisper
4. **摘要** — 透過 `llm-provider.ts` 生成詳細版摘要
5. **儲存** — 同時寫入 Obsidian 資料夾 + Notion database
6. **回報** — 通知 Discord / Dashboard 處理完成

## 輸出格式

### 檔案結構

```
Draco/yt-notes/
└── 2026-04-04-鑫源AI最新OpenClaw教程安裝CC-Switch配置模型切換一次講透/
    ├── 2026-04-04-鑫源AI最新OpenClaw教程安裝CC-Switch配置模型切換一次講透-摘要.md
    ├── 2026-04-04-鑫源AI最新OpenClaw教程安裝CC-Switch配置模型切換一次講透-逐字稿.md
    └── 2026-04-04-鑫源AI最新OpenClaw教程安裝CC-Switch配置模型切換一次講透.mp3
```

命名規則：
- 資料夾名：`{影片上傳日期}-{影片原始標題}`
- 檔案名：`{日期}-{標題}-{類型}.md` / `{日期}-{標題}.mp3`
- 標題保留原文（中文就中文，不翻譯成英文）

### 摘要.md Frontmatter

沿用現有 yt-summary 慣例，用 `source: manual` 區分手動觸發：

```yaml
---
type: yt-summary
title: "影片原始標題"
channel: "頻道名稱"
channel_id: "YouTube Channel ID"
date: 2026-04-04
url: "https://www.youtube.com/watch?v=xxxxx"
lang: zh
duration: "32:15"
source: manual
transcript: true
topics:
  - "Topic1"
  - "Topic2"
tags: [draco, yt-summary]
---
```

### 摘要.md 內容結構

```markdown
![](https://www.youtube.com/watch?v=xxxxx)

# 影片標題

## 核心概念
- 重點 bullet points

## 章節整理
- 00:00 - 開場介紹
- 02:30 - 段落標題
- ...

## 實作技巧 / 工具
- 實用建議

## 關鍵術語
- **術語** — 解釋

## 值得深入的部分
- 延伸學習建議

## 對你的啟發
- 個人化的行動建議
```

### 逐字稿.md

完整逐字稿文字，含時間戳（如有）。Frontmatter 包含基本影片資訊。

## API 設計

### YouTube 處理

```
POST /api/transcribe/youtube
Body: { url: "https://www.youtube.com/watch?v=xxxxx" }
Response: { jobId: "yt-1712345678", status: "processing" }
```

### 任務狀態查詢

```
GET /api/transcribe/status?jobId=yt-1712345678
Response: {
  jobId: "yt-1712345678",
  status: "completed" | "processing" | "failed",
  step: "downloading" | "transcribing" | "summarizing" | "saving",
  result?: { obsidianPath, notionUrl, title }
}
```

### 任務狀態管理

記憶體內 Map 存 job 狀態（一次性任務，不需持久化）：

```typescript
const jobs = new Map<string, {
  status: 'processing' | 'completed' | 'failed'
  step: string
  result?: { obsidianPath: string, notionUrl: string, title: string }
  error?: string
}>()
```

## Notion 整合

### 新建 Database：YT 深度研究

| 欄位 | 類型 | 說明 |
|------|------|------|
| Title | Title | 影片標題 |
| Channel | Select | 頻道名稱 |
| URL | URL | YouTube 連結 |
| Date | Date | 影片上傳日期 |
| Duration | Text | 影片長度 |
| Language | Select | zh / en / ja 等 |
| Topics | Multi-select | 主題標籤 |
| Has Transcript | Checkbox | 是否有逐字稿 |
| Obsidian Path | Text | Obsidian 資料夾路徑 |
| Status | Status | Done / Processing / Failed |

### API

```
POST /api/notion/yt-notes
Body: { title, channel, url, date, duration, lang, topics, summary, obsidianPath }
```

### 頁面內容

- 屬性填上述欄位
- 頁面 body 放摘要 markdown（核心概念、章節整理等）
- 逐字稿不放入（太長），改放 Obsidian 路徑連結

### 環境變數

```
NOTION_YT_NOTES_DATABASE_ID=xxx
```

## Dashboard UI 變更

### 語音轉錄工作站（Skills 頁面）

展開後顯示子功能卡片：
- 🎬 YT影片（可用）
- 📱 手機錄音（即將推出）
- 🖥️ 電腦錄影（即將推出）

YT 子功能包含：
- 輸入框貼 YouTube 連結 + 處理按鈕
- 處理進度顯示（downloading → transcribing → summarizing → saving）
- 最近處理列表，可展開看摘要 / 開 YT 連結 / 開 Notion

### 現有 YT 摘要改善（Overview 頁面）

`YtDigest` 元件加上展開功能，點擊可看摘要 MD 內容，不只是連結。

### yt-notes 瀏覽

OpenClaw Feed 新增 `yt-notes` 分類（或獨立區塊），顯示：
- 資料夾列表
- 展開看摘要 MD
- 開 YouTube 連結
- 標示是否有逐字稿和音檔

## 跨機器部署

- 兩台機器（本機 + Mac Mini）都跑 CycloneOS
- `git pull` 同步程式碼即可
- 兩台都需要安裝：`yt-dlp`、`ffmpeg`、`openai-whisper`
- 環境變數兩台都要設定 `NOTION_YT_NOTES_DATABASE_ID`

## 依賴項

需要安裝（系統層級）：
- `yt-dlp`（已安裝）
- `ffmpeg`（已安裝）
- `openai-whisper`（需安裝：`pip install openai-whisper`）

不需新增 npm 套件，yt-dlp 和 whisper 透過 `child_process` spawn 呼叫。

## 分階段計畫

- **Phase 1**（本次）— YouTube 影片處理全流程 + Dashboard + Notion
- **Phase 2**（未來）— 手機錄音上傳 → Whisper → 摘要
- **Phase 3**（未來）— 電腦錄影上傳 → 提取音軌 → Whisper → 摘要

## Discord Bot 觸發

Bot 收到 YouTube 連結：
1. 呼叫 `POST /api/transcribe/youtube`
2. 回覆「處理中...」
3. Polling `/api/transcribe/status`
4. 完成後回報結果（標題 + Obsidian 路徑 + Notion 連結）
