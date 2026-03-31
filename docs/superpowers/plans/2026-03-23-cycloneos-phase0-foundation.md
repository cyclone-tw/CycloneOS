# CycloneOS Phase 0: 地基 + Hooks 實作計畫

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立 `~/.cyclone/` 完整資料夾結構、設定 Claude Code hooks、建立 Obsidian vault 的 Cyclone 區域，讓後續所有 Phase 有穩固的基礎。

**Architecture:** 以 `~/.cyclone/` 為中心，config.json 管理所有路徑和設定，hooks 腳本處理 Claude Code 生命週期事件，Obsidian vault 新增 `Cyclone/` 目錄區隔 CycloneOS 產出與 OpenClaw 產出。

**Tech Stack:** Bash, jq, Claude Code hooks (settings.local.json), Obsidian (Markdown files)

**Spec:** `docs/superpowers/specs/2026-03-23-cycloneos-design.md`

---

## File Structure

### 新建檔案

```
~/.cyclone/
├── config.json                          # 全域設定（路徑、品牌、偏好）
├── assets/
│   └── logo-dragon.png                  # Logo（使用者手動放入）
├── scripts/
│   ├── hooks/
│   │   ├── session-start.sh             # SessionStart hook
│   │   ├── audit-log.sh                 # PostToolUse hook
│   │   ├── save-session.sh              # SessionEnd hook
│   │   └── notify.sh                    # Notification hook
│   ├── meeting/                         # (空，Phase 2 用)
│   ├── docs/                            # (空，Phase 4 用)
│   ├── pipeline/                        # (空，Phase 3 用)
│   └── dashboard/                       # (空，Phase 1 用)
├── logs/
│   └── audit.jsonl                      # 操作記錄（空檔）
├── templates/
│   ├── meetings/                        # (空，Phase 2 用)
│   └── slides/                          # (空，Phase 3 用)
├── knowledge/
│   └── index.json                       # 知識庫索引初始結構
├── output/
│   ├── slides/
│   ├── docs/
│   ├── teaching/
│   └── reports/
└── data/
    ├── transcripts/
    └── cache/

~/Library/CloudStorage/GoogleDrive-user@gmail.com/我的雲端硬碟/Obsidian-Cyclone/
└── Cyclone/                             # CycloneOS 專屬區域
    ├── sessions/                        # session log
    ├── meeting-notes/                   # 會議紀錄
    ├── pipeline-drafts/                 # 內容產線草稿
    └── knowledge-index/                 # 知識索引備份
```

### 修改檔案

```
/Users/username/CycloneOpenClaw/.claude/settings.local.json  # Claude Code hooks 設定
/Users/username/CycloneOpenClaw/CLAUDE.md                     # 更新路徑（不推 git，僅本地調整概念）
```

---

## Task 1: 建立 ~/.cyclone/ 基礎目錄結構

**Files:**
- Create: `~/.cyclone/` 及所有子目錄

- [ ] **Step 1: 建立完整目錄樹**

```bash
mkdir -p ~/.cyclone/{assets,scripts/{hooks,meeting,docs,pipeline,dashboard},logs,templates/{meetings,slides},knowledge,output/{slides,docs,teaching,reports},data/{transcripts,cache}}
```

- [ ] **Step 2: 驗證結構**

```bash
find ~/.cyclone -type d | sort
```

Expected: 列出所有 18 個子目錄

- [ ] **Step 3: 建立空的 audit.jsonl**

```bash
touch ~/.cyclone/logs/audit.jsonl
```

---

## Task 2: 建立 config.json

**Files:**
- Create: `~/.cyclone/config.json`

- [ ] **Step 1: 寫入設定檔**

```json
{
  "version": "1.0",
  "system_name": "CycloneOS",
  "paths": {
    "vault": "/Users/username/Library/CloudStorage/GoogleDrive-user@gmail.com/我的雲端硬碟/Obsidian-Cyclone",
    "school_drive": "/Users/username/Library/CloudStorage/GoogleDrive-cyclonetw@ksps.ntct.edu.tw",
    "repo": "/Users/username/CycloneOpenClaw",
    "cyclone_home": "/Users/username/.cyclone"
  },
  "brand": {
    "name": "Cyclone",
    "theme": "dark",
    "colors": {
      "bg_primary": "#0F172A",
      "bg_card": "#1E293B",
      "accent": "#38BDF8",
      "silver": "#C0C0C0",
      "text": "#F1F5F9",
      "success": "#22C55E",
      "error": "#EF4444",
      "warning": "#F59E0B"
    },
    "fonts": {
      "heading": "Noto Sans TC Bold",
      "body": "Noto Sans TC Regular"
    },
    "logo_path": "/Users/username/.cyclone/assets/logo-dragon.png"
  },
  "notion": {
    "tasks_db_id": "",
    "notes": "填入 CY Task 資料庫 ID"
  },
  "hooks": {
    "audit_log": "/Users/username/.cyclone/logs/audit.jsonl",
    "session_log_dir": "/Users/username/Library/CloudStorage/GoogleDrive-user@gmail.com/我的雲端硬碟/Obsidian-Cyclone/Cyclone/sessions"
  }
}
```

- [ ] **Step 2: 驗證 JSON 格式正確**

```bash
jq . ~/.cyclone/config.json > /dev/null && echo "OK" || echo "INVALID JSON"
```

Expected: `OK`

- [ ] **Step 3: 驗證路徑存在**

```bash
VAULT=$(jq -r '.paths.vault' ~/.cyclone/config.json)
ls "$VAULT/Draco/" > /dev/null 2>&1 && echo "Vault OK" || echo "Vault NOT FOUND"
```

Expected: `Vault OK`

---

## Task 3: 建立 Obsidian vault 的 Cyclone 區域

**Files:**
- Create: `${VAULT}/Cyclone/` 及子目錄

- [ ] **Step 1: 建立目錄**

```bash
VAULT=$(jq -r '.paths.vault' ~/.cyclone/config.json)
mkdir -p "$VAULT/Cyclone"/{sessions,meeting-notes,pipeline-drafts,knowledge-index}
```

- [ ] **Step 2: 建立 README**

在 `${VAULT}/Cyclone/README.md` 寫入：

```markdown
---
type: index
tags: [cycloneos]
---

# Cyclone — CycloneOS 產出區

此區域由 Claude Code（CycloneOS）產出，與 Draco（OpenClaw）區隔。

## 目錄結構
- `sessions/` — Claude Code session log
- `meeting-notes/` — 會議紀錄
- `pipeline-drafts/` — 內容產線草稿（簡報、教材、文章）
- `knowledge-index/` — 知識庫索引備份
```

- [ ] **Step 3: 驗證**

```bash
ls "$VAULT/Cyclone/"
```

Expected: `README.md  knowledge-index  meeting-notes  pipeline-drafts  sessions`

---

## Task 4: 建立知識庫索引初始結構

**Files:**
- Create: `~/.cyclone/knowledge/index.json`

- [ ] **Step 1: 寫入初始索引**

```json
{
  "version": "1.0",
  "last_updated": "",
  "sources": [
    {
      "id": "obsidian-research",
      "type": "obsidian",
      "path": "Draco/research/",
      "category": "research",
      "description": "OpenClaw 研究筆記"
    },
    {
      "id": "obsidian-cron",
      "type": "obsidian",
      "path": "Draco/cron/",
      "category": "daily-digest",
      "description": "OpenClaw 每日產出"
    },
    {
      "id": "obsidian-meetings",
      "type": "obsidian",
      "path": "Cyclone/meeting-notes/",
      "category": "meetings",
      "description": "CycloneOS 會議紀錄"
    },
    {
      "id": "obsidian-pipeline",
      "type": "obsidian",
      "path": "Cyclone/pipeline-drafts/",
      "category": "drafts",
      "description": "內容產線草稿"
    },
    {
      "id": "notion-tasks",
      "type": "notion",
      "database_id": "",
      "category": "tasks",
      "description": "Notion CY Task"
    },
    {
      "id": "school-drive",
      "type": "google-drive",
      "account": "cyclonetw@ksps.ntct.edu.tw",
      "category": "school-docs",
      "description": "學校公文與文件"
    },
    {
      "id": "local-output",
      "type": "local",
      "path": "~/.cyclone/output/",
      "category": "outputs",
      "description": "CycloneOS 所有產出"
    }
  ],
  "entries": []
}
```

- [ ] **Step 2: 驗證**

```bash
jq '.sources | length' ~/.cyclone/knowledge/index.json
```

Expected: `7`

---

## Task 5: 建立 Hook 腳本 — session-start.sh

**Files:**
- Create: `~/.cyclone/scripts/hooks/session-start.sh`

- [ ] **Step 1: 寫入腳本**

```bash
#!/bin/bash
# CycloneOS SessionStart Hook
# 每次 Claude Code session 開始時自動載入今日 brief
# [Fix I3] 使用快取避免 Google Drive 慢速掃描
# [Fix I6] 加入錯誤處理

command -v jq >/dev/null 2>&1 || { echo "CycloneOS: jq not found, skipping brief"; exit 0; }
[ -f "$HOME/.cyclone/config.json" ] || { echo "CycloneOS: config not found, skipping brief"; exit 0; }

CONFIG="$HOME/.cyclone/config.json"
VAULT=$(jq -r '.paths.vault' "$CONFIG")
CACHE_DIR="$HOME/.cyclone/data/cache"
CACHE_FILE="$CACHE_DIR/daily-brief.cache"
TODAY=$(date '+%Y-%m-%d')

mkdir -p "$CACHE_DIR"

# 快取機制：每天只掃描一次 vault，之後用快取
REBUILD_CACHE=false
if [ ! -f "$CACHE_FILE" ] || [ "$(head -1 "$CACHE_FILE" 2>/dev/null)" != "$TODAY" ]; then
  REBUILD_CACHE=true
fi

if [ "$REBUILD_CACHE" = true ]; then
  {
    echo "$TODAY"

    # 1. OpenClaw 最近 24 小時產出（限定子目錄，避免全 Draco 掃描）
    echo "CRON_FILES:"
    for subdir in daily-info mail-info yt-summary weekly-info; do
      find "$VAULT/Draco/cron/$subdir" -type f -name "*.md" -mtime -1 2>/dev/null | head -3
    done

    # 2. 待接手（只掃特定目錄，不掃全 Draco）
    echo "HANDOFF:"
    for subdir in research cron; do
      grep -rl "handoff: claude-code" "$VAULT/Draco/$subdir/" 2>/dev/null | head -3
    done
  } > "$CACHE_FILE" 2>/dev/null
fi

# 輸出 brief
echo "=== CycloneOS Daily Brief ==="
echo ""
echo "$(date '+%Y-%m-%d %A')"
echo ""

# OpenClaw 產出
echo "OpenClaw 最新產出："
CRON_SECTION=false
while IFS= read -r line; do
  if [ "$line" = "CRON_FILES:" ]; then CRON_SECTION=true; continue; fi
  if [ "$line" = "HANDOFF:" ]; then break; fi
  if [ "$CRON_SECTION" = true ] && [ -n "$line" ]; then
    echo "  - $(basename "$line")"
  fi
done < "$CACHE_FILE"
echo ""

# 最近 session
echo "最近 Session："
SESSION_DIR="$VAULT/Cyclone/sessions"
if [ -d "$SESSION_DIR" ]; then
  ls -t "$SESSION_DIR" 2>/dev/null | head -3 | while read f; do
    echo "  - $f"
  done
else
  echo "  （尚無 session 記錄）"
fi
echo ""

# Handoff
echo "待接手（handoff: claude-code）："
HANDOFF_SECTION=false
HAS_HANDOFF=false
while IFS= read -r line; do
  if [ "$line" = "HANDOFF:" ]; then HANDOFF_SECTION=true; continue; fi
  if [ "$HANDOFF_SECTION" = true ] && [ -n "$line" ]; then
    echo "  - $(basename "$line")"
    HAS_HANDOFF=true
  fi
done < "$CACHE_FILE"
if [ "$HAS_HANDOFF" = false ]; then
  echo "  （無）"
fi
echo ""

# Audit 統計
AUDIT="$HOME/.cyclone/logs/audit.jsonl"
if [ -f "$AUDIT" ] && [ -s "$AUDIT" ]; then
  TODAY_COUNT=$(grep -c "$TODAY" "$AUDIT" 2>/dev/null || echo 0)
  TOTAL=$(wc -l < "$AUDIT" | tr -d ' ')
  echo "Audit: 今日 ${TODAY_COUNT} 筆 / 累計 ${TOTAL} 筆"
else
  echo "Audit: 尚無記錄"
fi

echo ""
echo "=== Ready ==="
```

- [ ] **Step 2: 設定執行權限**

```bash
chmod +x ~/.cyclone/scripts/hooks/session-start.sh
```

- [ ] **Step 3: 測試執行**

```bash
~/.cyclone/scripts/hooks/session-start.sh
```

Expected: 顯示 daily brief 內容，不報錯

---

## Task 6: 建立 Hook 腳本 — audit-log.sh

**Files:**
- Create: `~/.cyclone/scripts/hooks/audit-log.sh`

- [ ] **Step 1: 寫入腳本**

```bash
#!/bin/bash
# CycloneOS PostToolUse Hook
# 記錄 Bash/Edit/Write 操作到 audit log
# [Fix C2] 使用 jq -n 安全建構 JSON，避免 injection

# 錯誤處理：非關鍵 hook，失敗不阻擋 Claude Code
command -v jq >/dev/null 2>&1 || exit 0
[ -d "$HOME/.cyclone/logs" ] || exit 0

INPUT=$(cat)
TOOL=$(echo "$INPUT" | jq -r '.tool_name // empty')
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
AUDIT="$HOME/.cyclone/logs/audit.jsonl"

touch "$AUDIT"

case "$TOOL" in
  Bash)
    DETAIL=$(echo "$INPUT" | jq -r '.tool_input.command // empty' | head -c 200 | tr '\n' ' ')
    ;;
  Edit|Write)
    DETAIL=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty' | head -c 200)
    ;;
  *)
    exit 0
    ;;
esac

jq -n --arg time "$TIMESTAMP" --arg tool "$TOOL" --arg detail "$DETAIL" \
  '{time: $time, tool: $tool, detail: $detail}' >> "$AUDIT"

exit 0
```

- [ ] **Step 2: 設定執行權限**

```bash
chmod +x ~/.cyclone/scripts/hooks/audit-log.sh
```

- [ ] **Step 3: 測試**

```bash
echo '{"tool_name":"Bash","tool_input":{"command":"ls -la"}}' | ~/.cyclone/scripts/hooks/audit-log.sh
cat ~/.cyclone/logs/audit.jsonl
```

Expected: audit.jsonl 有一筆合法 JSON：`{"time":"...","tool":"Bash","detail":"ls -la"}`
驗證 JSON 格式正確：`jq . ~/.cyclone/logs/audit.jsonl`（不報錯）

- [ ] **Step 4: 清理測試資料**

```bash
> ~/.cyclone/logs/audit.jsonl
```

---

## Task 7: 建立 Hook 腳本 — save-session.sh

**Files:**
- Create: `~/.cyclone/scripts/hooks/save-session.sh`

- [ ] **Step 1: 寫入腳本**

```bash
#!/bin/bash
# CycloneOS SessionEnd Hook
# Session 結束時自動存 log 到 Obsidian vault
# [Fix C1] 不讀 stdin（SessionEnd hook 不提供 transcript_path）
# [Fix I6] 加入錯誤處理

command -v jq >/dev/null 2>&1 || exit 0
[ -f "$HOME/.cyclone/config.json" ] || exit 0

CONFIG="$HOME/.cyclone/config.json"
SESSION_DIR=$(jq -r '.hooks.session_log_dir' "$CONFIG")
AUDIT="$HOME/.cyclone/logs/audit.jsonl"
TODAY=$(date '+%Y-%m-%d')

# 確保目錄存在
mkdir -p "$SESSION_DIR" 2>/dev/null || exit 0

# 計算今天第幾個 session
COUNT=$(ls "$SESSION_DIR" 2>/dev/null | grep "^$TODAY" | wc -l | tr -d ' ')
NEXT=$((COUNT + 1))

FILENAME="$SESSION_DIR/$TODAY-session-$NEXT.md"

# 今日操作統計（純讀 audit log，不依賴 stdin）
if [ -f "$AUDIT" ] && [ -s "$AUDIT" ]; then
  TODAY_OPS=$(grep -c "$TODAY" "$AUDIT" 2>/dev/null || echo 0)
  LAST_OPS=$(tail -10 "$AUDIT" 2>/dev/null)
else
  TODAY_OPS=0
  LAST_OPS="（無操作記錄）"
fi

cat > "$FILENAME" << EOF
---
type: session-log
date: $TODAY
session: $NEXT
source: cycloneos
tags: [cyclone, session-log, auto-generated]
---

# $TODAY Session $NEXT

> 由 CycloneOS SessionEnd hook 自動產生。

## 統計
- 今日操作數：$TODAY_OPS
- Session 結束時間：$(date '+%H:%M:%S')

## 最近 10 筆操作
\`\`\`
$LAST_OPS
\`\`\`
EOF

echo "Session log saved: $FILENAME"
exit 0
```

- [ ] **Step 2: 設定執行權限**

```bash
chmod +x ~/.cyclone/scripts/hooks/save-session.sh
```

- [ ] **Step 3: 測試**

```bash
~/.cyclone/scripts/hooks/save-session.sh
```

Expected: 顯示 `Session log saved: ...` 並在 Obsidian vault 產生檔案

- [ ] **Step 4: 驗證產出檔案**

```bash
VAULT=$(jq -r '.paths.vault' ~/.cyclone/config.json)
ls "$VAULT/Cyclone/sessions/"
cat "$VAULT/Cyclone/sessions/$(date '+%Y-%m-%d')-session-1.md"
```

Expected: 檔案存在，格式正確

- [ ] **Step 5: 清理測試檔案**

```bash
rm "$VAULT/Cyclone/sessions/$(date '+%Y-%m-%d')-session-1.md"
```

---

## Task 8: 建立 Hook 腳本 — notify.sh

**Files:**
- Create: `~/.cyclone/scripts/hooks/notify.sh`

- [ ] **Step 1: 寫入腳本**

```bash
#!/bin/bash
# CycloneOS Notification Hook
# Claude Code 需要注意時發送 macOS 通知

osascript -e 'display notification "Claude Code 需要你的注意" with title "🐉 CycloneOS" sound name "Glass"'
exit 0
```

- [ ] **Step 2: 設定執行權限**

```bash
chmod +x ~/.cyclone/scripts/hooks/notify.sh
```

- [ ] **Step 3: 測試**

```bash
~/.cyclone/scripts/hooks/notify.sh
```

Expected: macOS 右上角出現通知

---

## Task 9: 設定 Claude Code Hooks（settings.local.json）

**Files:**
- Create: `/Users/username/CycloneOpenClaw/.claude/settings.local.json`

- [ ] **Step 1: 確認 .claude 目錄存在**

```bash
mkdir -p /Users/username/CycloneOpenClaw/.claude
```

- [ ] **Step 2: 寫入 settings.local.json**

```json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "/Users/username/.cyclone/scripts/hooks/session-start.sh"
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
            "command": "/Users/username/.cyclone/scripts/hooks/audit-log.sh"
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
            "command": "/Users/username/.cyclone/scripts/hooks/notify.sh"
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
            "command": "/Users/username/.cyclone/scripts/hooks/save-session.sh"
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
            "prompt": "檢查你是否完成了使用者的所有請求。如果使用者只是在聊天、討論或詢問，直接回 {\"ok\": true}。只有明確的工作任務才需要檢查。回應 {\"ok\": true} 或 {\"ok\": false, \"reason\": \"還缺什麼\"}。",
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
            "command": "INPUT=$(cat); FILE=$(echo \"$INPUT\" | jq -r '.tool_input.file_path // empty'); if echo \"$FILE\" | grep -qiE '(學生個資|student.*personal|credentials|\\.env$)'; then echo '🚫 禁止修改敏感檔案' >&2; exit 2; fi; exit 0"
          }
        ]
      }
    ]
  }
}
```

- [ ] **Step 3: 確認 settings.local.json 在 .gitignore**

```bash
echo "settings.local.json" >> /Users/username/CycloneOpenClaw/.claude/.gitignore 2>/dev/null || true
```

- [ ] **Step 4: 驗證 JSON 格式**

```bash
jq . /Users/username/CycloneOpenClaw/.claude/settings.local.json > /dev/null && echo "OK" || echo "INVALID"
```

Expected: `OK`

---

## Task 10: 驗證 MCP 連線

- [ ] **Step 1: 測試 Notion MCP**

在 Claude Code 中執行：
```
請用 Notion MCP 搜尋 "CY Task"
```

Expected: 能搜到 Notion 資料。如果失敗，需重新授權。

- [ ] **Step 2: 測試 Gmail MCP**

```
請用 Gmail MCP 列出最近 3 封信
```

Expected: 能列出信件。

- [ ] **Step 3: 測試 Canva MCP**

```
請用 Canva MCP 搜尋我的設計
```

Expected: 能列出設計。如果未連接，記錄到待辦。

- [ ] **Step 4: 記錄 MCP 狀態**

將結果記到 config.json 或 notes：
```bash
# 手動更新 config.json 的 notion.tasks_db_id（如果 Step 1 成功拿到 DB ID）
```

---

## Task 11: 安裝基礎依賴

- [ ] **Step 1: 確認 jq 已安裝**

```bash
jq --version
```

Expected: 顯示版本號。如果沒有：`brew install jq`

- [ ] **Step 2: 確認 python3 可用**

```bash
python3 --version
```

Expected: Python 3.x

- [ ] **Step 3: 安裝 python-docx（會議紀錄用）**

```bash
pip3 install python-docx
```

- [ ] **Step 4: 確認 Node.js 可用（Dashboard 用）**

```bash
node --version && npm --version
```

Expected: Node 18+ 和 npm。如果沒有：`brew install node`

---

## Task 12: 端到端驗證

- [ ] **Step 1: 重啟 Claude Code session**

退出並重新進入 Claude Code，確認 SessionStart hook 自動觸發。

Expected: 看到 `=== 🐉 CycloneOS Daily Brief ===` 輸出

- [ ] **Step 2: 執行一個 Bash 命令，確認 audit log**

```bash
ls ~/.cyclone/
```

然後檢查：
```bash
cat ~/.cyclone/logs/audit.jsonl
```

Expected: 有一筆 `ls ~/.cyclone/` 的記錄

- [ ] **Step 3: 測試敏感檔案保護**

嘗試建立一個名為 `學生個資.txt` 的檔案，確認 PreToolUse hook 阻擋。

- [ ] **Step 4: 確認整體結構完整**

```bash
echo "=== ~/.cyclone/ ===" && find ~/.cyclone -type f | sort && echo "" && echo "=== Obsidian/Cyclone/ ===" && VAULT=$(jq -r '.paths.vault' ~/.cyclone/config.json) && find "$VAULT/Cyclone" -type f | sort
```

Expected: 所有檔案都在正確位置

- [ ] **Step 5: Commit**

```bash
cd /Users/username/CycloneOpenClaw
git add .claude/settings.local.json docs/superpowers/
git commit -m "feat: CycloneOS Phase 0 — foundation + hooks setup

- Add design spec and Phase 0 implementation plan
- Configure Claude Code hooks (SessionStart, PostToolUse, Notification, SessionEnd, Stop, PreToolUse)
- Note: ~/.cyclone/ structure is local, not in repo"
```

---

## 完成確認

Phase 0 完成後，你應該有：

| 項目 | 狀態 |
|------|------|
| `~/.cyclone/` 完整結構 | ✅ |
| `config.json` 設定檔 | ✅ |
| 6 個 Claude Code hooks | ✅ |
| Obsidian `Cyclone/` 區域 | ✅ |
| `knowledge/index.json` 初始索引 | ✅ |
| audit log 運作中 | ✅ |
| session log 自動存檔 | ✅ |
| macOS 通知 | ✅ |
| 敏感檔案保護 | ✅ |
| MCP 連線驗證 | ✅ |
| 基礎依賴安裝 | ✅ |

**下一步：** Plan 2 — Dashboard MVP（Phase 1）
