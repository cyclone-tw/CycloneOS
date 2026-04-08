---
type: design-spec
date: 2026-03-23
tags: [cycloneos, claude-code, dashboard, workflow, draco]
---

# CycloneOS — AI Agent 工作流系統設計規格

## 1. 願景

將 Claude Code 打造成主力 AI Agent，搭配 OpenClaw 的排程能力，建立一個涵蓋業務、教學、學習、生活的全方位工作流系統。

核心原則（源自 Raymond 雷小蒙的啟發）：
- **所有產出都是 AI 可讀格式**（HTML/MD/JSON），不鎖在封閉工具裡
- **知識庫是核心資產** — Obsidian + Notion 作為統一索引
- **OpenClaw 完成任務，Claude Code 改善系統 + 進階創作**
- **Dashboard 是中央樞紐**，不是事後補充

## 2. 使用者背景

- 特教資源班教師 + 資訊業務承辦人 + 進修部主任（三角色）
- 業務含大量會議（IEP、特推會、陳會、線上會議）
- 公文/文件以 doc/docx/xls/pdf 為主，存在 Google Drive（ksps 帳號）
- 已有 OpenClaw 跑在 Mac Mini（24/7 cron、Discord）
- 這台 Mac 為 Claude Code 主力工作環境，不裝 OpenClaw

## 3. 系統架構

### 3.1 整體拓撲

```
┌──────────────────────────────────────────────────────────────┐
│                     CycloneOS Dashboard                       │
│                  (Next.js, localhost:3000)                     │
│                                                               │
│  📅 Calendar    📋 Notion Tasks   📧 Mail      🎙 會議紀錄   │
│  📊 OpenClaw    📁 文件索引       📝 筆記      ⚡ 活動時間軸  │
│  🎨 內容產線    🖥 簡報生成       📦 專案追蹤                 │
└───────────────────────┬──────────────────────────────────────┘
                        │ 讀取 JSON/Log/API
┌───────────────────────▼──────────────────────────────────────┐
│               這台 Mac（Claude Code 主力）                     │
│                                                               │
│  ~/.cyclone/                                                  │
│  ├── config.json            ← 跨平台設定                      │
│  ├── scripts/               ← 所有自動化腳本                  │
│  │   ├── hooks/             ← Claude Code hooks               │
│  │   ├── meeting/           ← 會議錄音處理                    │
│  │   ├── docs/              ← 公文分析                        │
│  │   ├── pipeline/          ← 內容產線（簡報/教材/文章）      │
│  │   └── dashboard/         ← Dashboard 資料蒐集              │
│  ├── logs/                  ← audit log, session log          │
│  ├── templates/             ← Word/HTML 模板                  │
│  │   ├── meetings/          ← 各類會議模板                    │
│  │   └── slides/            ← 簡報品牌版型                    │
│  ├── knowledge/             ← 知識庫索引                      │
│  ├── output/                ← 統一產出目錄                    │
│  │   ├── slides/            │
│  │   ├── docs/              │
│  │   ├── teaching/          │
│  │   └── reports/           │
│  └── data/                  ← 中間資料暫存                    │
│                                                               │
│  Claude Code Hooks                                            │
│  ├── SessionStart  → 載入今日 brief                           │
│  ├── PostToolUse   → 操作 audit log                           │
│  ├── Notification  → macOS 桌面通知                           │
│  ├── SessionEnd    → 自動存 session log                       │
│  └── Stop          → prompt hook 驗證完成度                   │
│                                                               │
│  MCP 連線                                                     │
│  ├── Notion     → CY Task、知識庫                             │
│  ├── Gmail      → user@gmail.com                         │
│  ├── Canva      → 簡報/教材                                   │
│  ├── Playwright → 網頁操作                                    │
│  └── Calendar   → Google Calendar（待接）                     │
└──────────────────────────────────────────────────────────────┘
         │ GitHub sync              │ Google Drive sync
         ▼                         ▼
┌─────────────────┐    ┌────────────────────────────────────┐
│ CycloneOpenClaw │    │ Obsidian Vault                      │
│ repo (共用)     │    │  └── Draco/    (OpenClaw 產出)      │
└─────────────────┘    │  └── Cyclone/  (CycloneOS 產出)     │
         │              │      ├── sessions/                  │
         ▼              │      ├── meeting-notes/             │
┌─────────────────┐    │      ├── pipeline-drafts/           │
│ Mac Mini         │    │      └── knowledge-index/           │
│ OpenClaw 24/7    │    └────────────────────────────────────┘
│ cron/Discord     │
└─────────────────┘
```

### 3.2 ~/.cyclone/ 資料夾結構

```
~/.cyclone/
├── config.json                  # 全域設定
│   {
│     "vault_path": "~/Library/CloudStorage/GoogleDrive-user@gmail.com/我的雲端硬碟/Obsidian-Cyclone",
│     "school_drive": "~/Library/CloudStorage/GoogleDrive-user@school.edu.tw",
│     "notion_tasks_db": "<CY Task DB ID>",
│     "brand": {
│       "name": "Cyclone",
│       "theme": "dark",
│       "primary_color": "#0F172A",
│       "accent_color": "#38BDF8",
│       "silver": "#C0C0C0",
│       "font_heading": "Noto Sans TC Bold",
│       "font_body": "Noto Sans TC Regular",
│       "logo_path": "~/.cyclone/assets/logo-dragon.png"
│     }
│   }
│
├── assets/
│   ├── logo-dragon.png          # 銀龍 Logo
│   └── avatar.png               # 個人 avatar
│
├── scripts/
│   ├── hooks/                   # Claude Code hooks
│   │   ├── session-start.sh     # 每次 session 載入 daily brief
│   │   ├── audit-log.sh         # 記錄所有工具操作
│   │   ├── save-session.sh      # session 結束存 log
│   │   └── notify.sh            # macOS 通知
│   ├── meeting/
│   │   ├── transcribe.sh        # 音檔 → 逐字稿（Whisper）
│   │   └── generate-minutes.sh  # 逐字稿 → 套模板 → docx
│   ├── docs/
│   │   └── analyze-doc.sh       # 公文分析
│   ├── pipeline/
│   │   ├── slides-generate.sh   # 簡報生成
│   │   ├── teaching-material.sh # 教材生成
│   │   └── article-draft.sh     # 文章/報告
│   └── dashboard/
│       ├── fetch-notion.sh      # 抓 Notion 資料
│       ├── fetch-calendar.sh    # 抓 Calendar 資料
│       └── build-state.sh       # 組合成 dashboard-state.json
│
├── logs/
│   ├── audit.jsonl              # Claude Code 操作記錄
│   └── sessions/                # session log 存檔
│
├── templates/
│   ├── meetings/
│   │   ├── iep-meeting.docx     # IEP 會議紀錄模板
│   │   ├── special-committee.docx  # 特推會模板
│   │   └── general-meeting.docx    # 一般陳會模板
│   └── slides/
│       ├── base.html            # 簡報基礎版型（reveal.js + 品牌樣式）
│       ├── cover.html           # 封面頁模板
│       ├── content.html         # 內容頁模板
│       ├── chart.html           # 圖表頁模板
│       └── closing.html         # 結尾頁模板
│
├── knowledge/
│   └── index.json               # 知識庫統一索引
│
├── output/
│   ├── slides/                  # YYYY-MM-DD-<topic>/
│   ├── docs/                    # 文件產出
│   ├── teaching/                # 教材產出
│   └── reports/                 # 報告產出
│
└── data/
    ├── transcripts/             # 逐字稿暫存
    └── cache/                   # API 快取
```

### 3.3 Claude Code Hooks 設定

```json
// .claude/settings.local.json（這台 Mac 專用，不推 git）
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "~/.cyclone/scripts/hooks/session-start.sh"
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Bash|Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "~/.cyclone/scripts/hooks/audit-log.sh"
          }
        ]
      }
    ],
    "Notification": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "~/.cyclone/scripts/hooks/notify.sh"
          }
        ]
      }
    ],
    "SessionEnd": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "~/.cyclone/scripts/hooks/save-session.sh"
          }
        ]
      }
    ],
    "Stop": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "prompt",
            "prompt": "檢查你是否完成了使用者的所有請求。回應 {\"ok\": true} 或 {\"ok\": false, \"reason\": \"還缺什麼\"}。注意：如果使用者只是在聊天或討論，不需要檢查完成度，直接回 {\"ok\": true}。",
            "model": "claude-haiku-4-5-20251001"
          }
        ]
      }
    ],
    "PreToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "INPUT=$(cat); FILE=$(echo \"$INPUT\" | jq -r '.tool_input.file_path // empty'); if echo \"$FILE\" | grep -qE '(學生個資|credentials|\\.env)'; then echo '禁止修改敏感檔案' >&2; exit 2; fi; exit 0"
          }
        ]
      }
    ]
  }
}
```

### 3.4 Hook 腳本詳細設計

#### session-start.sh

```bash
#!/bin/bash
# 載入今日 brief：Notion 待辦 + Calendar + OpenClaw 最新產出
CONFIG="$HOME/.cyclone/config.json"
VAULT=$(jq -r '.vault_path' "$CONFIG")

echo "=== CycloneOS Daily Brief ==="
echo ""

# 1. 今日日期
echo "📅 $(date '+%Y-%m-%d %A')"
echo ""

# 2. 最近的 OpenClaw cron 產出
echo "📊 OpenClaw 最新產出："
find "$VAULT/Draco/cron" -type f -name "*.md" -mtime -1 2>/dev/null | head -5 | while read f; do
  echo "  - $(basename "$f")"
done
echo ""

# 3. 最近的 session log
echo "📝 最近 Session："
ls -t "$VAULT/Draco/01.OpenClaw/Claude session-logs/" 2>/dev/null | head -3 | while read f; do
  echo "  - $f"
done

# 4. 待處理的 handoff 檔案
echo ""
echo "🔄 待接手（handoff: claude-code）："
grep -rl "handoff: claude-code" "$VAULT/Draco/" 2>/dev/null | head -5 | while read f; do
  echo "  - $(basename "$f")"
done || echo "  （無）"
```

#### audit-log.sh

```bash
#!/bin/bash
# 記錄所有 Bash/Edit/Write 操作到 audit log
INPUT=$(cat)
TOOL=$(echo "$INPUT" | jq -r '.tool_name')
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

case "$TOOL" in
  Bash)
    CMD=$(echo "$INPUT" | jq -r '.tool_input.command' | head -c 200)
    echo "{\"time\":\"$TIMESTAMP\",\"tool\":\"Bash\",\"detail\":\"$CMD\"}" >> ~/.cyclone/logs/audit.jsonl
    ;;
  Edit|Write)
    FILE=$(echo "$INPUT" | jq -r '.tool_input.file_path' | head -c 200)
    echo "{\"time\":\"$TIMESTAMP\",\"tool\":\"$TOOL\",\"detail\":\"$FILE\"}" >> ~/.cyclone/logs/audit.jsonl
    ;;
esac
exit 0
```

#### save-session.sh

```bash
#!/bin/bash
# Session 結束時自動存摘要到 Obsidian vault
CONFIG="$HOME/.cyclone/config.json"
VAULT=$(jq -r '.vault_path' "$CONFIG")
SESSION_DIR="$VAULT/Cyclone/sessions"
TODAY=$(date '+%Y-%m-%d')

mkdir -p "$SESSION_DIR"

# 計算今天第幾個 session
COUNT=$(ls "$SESSION_DIR" 2>/dev/null | grep "^$TODAY" | wc -l | tr -d ' ')
NEXT=$((COUNT + 1))

FILENAME="$SESSION_DIR/$TODAY-session-$NEXT.md"

# 從 transcript 擷取摘要（如果有）
TRANSCRIPT=$(jq -r '.transcript_path' < /dev/stdin 2>/dev/null)

cat > "$FILENAME" << EOF
---
type: session-log
date: $TODAY
session: $NEXT
source: cycloneos
tags: [cyclone, session-log]
---

# $TODAY Session $NEXT

> 自動產生的 session 記錄。詳細內容請參考 audit log。

## 操作統計
$(wc -l < ~/.cyclone/logs/audit.jsonl 2>/dev/null || echo 0) 筆操作記錄

## audit log 最後 10 筆
$(tail -10 ~/.cyclone/logs/audit.jsonl 2>/dev/null || echo "（無）")
EOF

echo "Session log saved: $FILENAME"
```

#### notify.sh

```bash
#!/bin/bash
osascript -e 'display notification "Claude Code 需要你的注意" with title "CycloneOS" sound name "Glass"'
exit 0
```

## 4. Dashboard 設計

### 4.1 技術選型

- **框架**：Next.js 15 (App Router)
- **部署**：localhost:3000（本地，未來可選 Vercel/Zeabur）
- **UI**：Tailwind CSS + shadcn/ui
- **主題**：暗色系，麥肯錫風格
- **配色**：
  - 背景：`#0F172A`（深海軍藍）
  - 卡片：`#1E293B`（暗灰藍）
  - 強調：`#38BDF8`（青藍，呼應 Logo 科技感）
  - 銀色：`#C0C0C0`（Logo 呼應）
  - 文字：`#F1F5F9`（淺灰白）
  - 成功：`#22C55E` / 失敗：`#EF4444` / 警告：`#F59E0B`
- **字型**：Noto Sans TC（Google Fonts，繁中最佳無襯線字型）

### 4.2 頁面結構（參考 Kairos Dashboard）

```
側邊欄（固定）
├── 🐉 CycloneOS（Logo + 名稱）
├── ⚡ Activity（活動總覽 — 首頁）
├── 📅 Timeline（時間軸）
├── 📋 Tasks（Notion CY Task）
├── 📁 Documents（文件索引）
├── 🎙 Meetings（會議紀錄）
├── 🎨 Pipeline（內容產線）
├── 🖥 Slides（簡報生成）
├── 📝 Notes（學習筆記）
├── 📊 OpenClaw（cron 狀態）
└── ⚙️ Settings
```

### 4.3 Activity 首頁（類似 Kairos）

```
┌─────────────────────────────────────────────────────────┐
│  ⚡ Activity                     🕐 最後更新 5 分鐘前    │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐               │
│  │  12  │  │   3  │  │  OK  │  │  8   │               │
│  │自動化 │  │需關注 │  │系統  │  │今日   │               │
│  │ 任務  │  │      │  │狀態  │  │待辦   │               │
│  └──────┘  └──────┘  └──────┘  └──────┘               │
│                                                          │
│  📋 今日行程（Google Calendar）                           │
│  ┌─────────────────────────────────────┐               │
│  │ 09:00  IEP 會議 - 王同學             │               │
│  │ 14:00  特推會                        │               │
│  │ 16:00  資訊業務會議                  │               │
│  └─────────────────────────────────────┘               │
│                                                          │
│  🤖 Claude Code Sessions                                │
│  ┌───────────┐  ┌───────────┐                          │
│  │ 目前 session│  │ audit log │                          │
│  │ 已跑 45 min │  │ 28 筆操作 │                          │
│  └───────────┘  └───────────┘                          │
│                                                          │
│  📊 OpenClaw 狀態                                       │
│  ┌───────────┐  ┌───────────┐  ┌───────────┐          │
│  │ daily-info │  │mail-summary│  │ yt-monitor │          │
│  │ ✅ 06:00   │  │ ✅ 09:00   │  │ ⚠️ 失敗    │          │
│  └───────────┘  └───────────┘  └───────────┘          │
│                                                          │
│  🎨 內容產線                                            │
│  ┌───────────┐  ┌───────────┐                          │
│  │ 待處理簡報 │  │ 最近產出   │                          │
│  │    2 份    │  │   5 份     │                          │
│  └───────────┘  └───────────┘                          │
│                                                          │
│  ⚡ 活動時間軸（最近操作）                               │
│  12:30  Edit  ~/.cyclone/templates/slides/base.html     │
│  12:28  Bash  npm run build                             │
│  12:25  Write docs/meeting-notes/2026-03-23-iep.md      │
└─────────────────────────────────────────────────────────┘
```

## 5. 內容產線（Pipeline）

### 5.1 簡報生成工作流

#### 分工原則

| 階段 | 負責 | 說明 |
|------|------|------|
| 知識蒐集 | OpenClaw 或 Claude Code | 掃描知識庫、Felo 研究、配圖 |
| 初稿產出 | OpenClaw（如有 handoff）或 Claude Code | 70 分 Markdown 大綱 |
| HTML 版型套入 | Claude Code | 套品牌版型、排版、動畫 |
| 進階編輯 | Claude Code + 你 | 即時預覽、對話微調 |
| 最終匯出 | Claude Code | PDF / HTML / 同步到 Obsidian |

#### 品牌版型規格

```
主題：暗色系麥肯錫風格
背景：#0F172A（深海軍藍）
標題色：#F1F5F9（淺灰白）
強調色：#38BDF8（青藍）
輔助色：#C0C0C0（銀，呼應 Logo）
字型：Noto Sans TC
Logo：右下角龍形浮水印（低透明度）

頁面類型：
- 封面：大標題 + 副標 + Logo + 日期
- 目錄：左右分欄，數字導航
- 內容：標題 + 2-3 要點 + 配圖區
- 圖表：全版圖表 + 底部說明
- 引用：大字引言 + 來源
- 結尾：總結 + CTA + Logo
```

#### 技術實現

- 框架：reveal.js（HTML 簡報框架）
- 每份簡報 = 一個資料夾：`output/slides/YYYY-MM-DD-<topic>/`
  - `index.html` — 簡報主檔
  - `assets/` — 圖片、配圖
  - `meta.json` — 中繼資料（標題、日期、來源、知識庫引用）
- 全部是 HTML/JSON，AI 永遠可讀可學

### 5.2 會議錄音工作流

```
音檔（m4a/mp3/wav）
  │
  ▼
transcribe.sh（Whisper API 或本地 whisper.cpp）
  │ 產出：data/transcripts/YYYY-MM-DD-<meeting>.txt
  ▼
generate-minutes.sh
  │ Claude 摘要 + 套模板
  │ 判斷會議類型 → 選對應 Word 模板
  ▼
output/docs/YYYY-MM-DD-<meeting>.docx（有模板的）
output/docs/YYYY-MM-DD-<meeting>.md（自由格式的）
  │
  ▼
自動索引到 knowledge/index.json
同步到 Obsidian vault: Cyclone/meeting-notes/
Dashboard 更新
```

### 5.3 公文處理工作流

```
Google Drive（ksps 帳號）文件
  │ 手動指定或掃描新檔
  ▼
analyze-doc.sh
  │ 讀取 doc/docx/pdf
  │ Claude 分析：類型、重點、需要回應的項目、期限
  ▼
output/reports/YYYY-MM-DD-<doc-title>.md
  │ 摘要 + 行動項目
  ▼
索引 + Dashboard 更新
可選：自動建立 Notion 待辦
```

## 6. 知識庫索引

### 6.1 索引結構

```json
// knowledge/index.json
{
  "version": "1.0",
  "last_updated": "2026-03-23T12:00:00Z",
  "sources": [
    {
      "type": "obsidian",
      "path": "Draco/research/",
      "category": "research"
    },
    {
      "type": "obsidian",
      "path": "Draco/cron/",
      "category": "daily-digest"
    },
    {
      "type": "obsidian",
      "path": "Cyclone/meeting-notes/",
      "category": "meetings"
    },
    {
      "type": "obsidian",
      "path": "Cyclone/pipeline-drafts/",
      "category": "drafts"
    },
    {
      "type": "notion",
      "database_id": "<CY Task DB>",
      "category": "tasks"
    },
    {
      "type": "google-drive",
      "account": "user@school.edu.tw",
      "category": "school-docs"
    },
    {
      "type": "local",
      "path": "~/.cyclone/output/",
      "category": "outputs"
    }
  ],
  "entries": []
}
```

### 6.2 索引用途

- Dashboard 全文搜尋
- 簡報生成時掃描相關內容
- 會議紀錄引用歷史決議
- 公文處理時參考過去案例

## 7. OpenClaw Handoff 機制

延續原有 roadmap Phase 3 的設計：

```yaml
# OpenClaw 產出的檔案 frontmatter
---
type: research-note
date: 2026-03-23
handoff: claude-code
handoff-action: slides | article | review | edit
source-skill: web-research | felo-search | audio-summary
tags: [research, 特教]
---
```

Claude Code SessionStart hook 自動掃描帶有 `handoff: claude-code` 的檔案，列出待處理項目。

## 8. Roadmap

### Phase 0: 地基（第 1 週）

| # | 任務 | 說明 | Hook 整合 |
|---|------|------|-----------|
| 0-1 | 建立 `~/.cyclone/` 完整結構 | 所有子目錄 + config.json | — |
| 0-2 | 設定 Claude Code hooks | 5 個核心 hook + 1 個保護 hook | 全部 |
| 0-3 | 建立 `Obsidian/Cyclone/` 目錄 | sessions/, meeting-notes/, pipeline-drafts/ | SessionEnd hook 寫入 |
| 0-4 | 更新 CLAUDE.md | 適配這台 Mac 路徑、移除 backup 相關 | — |
| 0-5 | 驗證 MCP 連線 | Notion、Gmail、Canva、Playwright | — |
| 0-6 | 安裝基礎依賴 | jq, python-docx, whisper (可選) | — |

### Phase 1: Dashboard MVP（第 2 週）

| # | 任務 | 說明 | Hook 整合 |
|---|------|------|-----------|
| 1-1 | Next.js 專案初始化 | App Router + Tailwind + shadcn/ui | — |
| 1-2 | 暗色主題 + 品牌樣式 | 配色、字型、Logo、側邊欄 | — |
| 1-3 | Activity 首頁 | 統計卡片 + 時間軸 | 讀 audit.jsonl |
| 1-4 | 接入 Notion CY Task | API route → 任務看板 | — |
| 1-5 | 接入 Google Calendar | API route → 今日行程 | — |
| 1-6 | 接入 OpenClaw 狀態 | 讀 Obsidian vault cron 產出 | — |
| 1-7 | 接入 audit log | 即時活動時間軸 | PostToolUse hook |

### Phase 2: 會議錄音工作流（第 3 週）

| # | 任務 | 說明 | Hook 整合 |
|---|------|------|-----------|
| 2-1 | Whisper 轉逐字稿 | 本地或 API，支援 m4a/mp3/wav | — |
| 2-2 | 會議摘要引擎 | Claude 分析 → 結構化摘要 | — |
| 2-3 | Word 模板引擎 | python-docx 填入對應模板 | — |
| 2-4 | 整合到 Dashboard | Meetings 頁面 — 列表 + 搜尋 | — |
| 2-5 | 產出通知 | 完成後 macOS 通知 + 索引更新 | Notification hook |

### Phase 3: 內容產線 — 簡報生成（第 4 週）

| # | 任務 | 說明 | Hook 整合 |
|---|------|------|-----------|
| 3-1 | 知識庫索引 MVP | Obsidian + Notion 掃描建索引 | — |
| 3-2 | 簡報品牌版型 | reveal.js + 暗色麥肯錫風格 | — |
| 3-3 | 「一句話生簡報」 | 掃知識庫 → 大綱 → HTML 簡報 | — |
| 3-4 | Canva MCP 整合 | 可選：直接在 Canva 建簡報 | — |
| 3-5 | OpenClaw handoff | Felo 配圖 → 標記 handoff → Claude Code 精修 | SessionStart hook 掃描 |
| 3-6 | Dashboard Pipeline 頁 | 產線狀態 + 歷史產出列表 | — |

### Phase 4: 公文/文件處理（第 5-6 週）

| # | 任務 | 說明 | Hook 整合 |
|---|------|------|-----------|
| 4-1 | Google Drive 讀取 | ksps 帳號文件存取 | — |
| 4-2 | 公文分析工作流 | 類型判斷 + 摘要 + 行動項目 | — |
| 4-3 | Dashboard 文件索引 | Documents 頁面 | — |
| 4-4 | 新公文通知 | 偵測新檔 → 通知 | 可接 hook 或 cron |

### Phase 5: 知識庫深度整合（第 7-8 週）

| # | 任務 | 說明 |
|---|------|------|
| 5-1 | 向量化搜尋 | 嵌入式知識檢索（embeddings） |
| 5-2 | Dashboard 全文搜尋 | 跨所有來源搜尋 |
| 5-3 | 內容產線深度整合 | 教材、文章自動引用知識庫 |

### Phase 6: 教學 + IEP（遠期）

| # | 任務 | 說明 |
|---|------|------|
| 6-1 | HTML 數位教材生成 | 互動式教材 |
| 6-2 | 學習筆記自動索引 | 個人學習追蹤 |
| 6-3 | IEP 學生資料整合 | 最複雜，充分準備後再做 |

## 9. 設計原則

1. **AI 可讀優先** — 所有產出用 HTML/MD/JSON，拒絕封閉格式
2. **知識庫是核心** — 所有產出都索引回知識庫，讓 AI 能學習
3. **Hook 驅動自動化** — 減少手動步驟，事件觸發自動執行
4. **漸進式建設** — 每個 Phase 都有可用的 MVP，不等全部做完才用
5. **雙軌分工** — OpenClaw 完成任務，Claude Code 改善系統 + 進階創作
6. **個資保護** — 學生資料透過 PreToolUse hook 防護
