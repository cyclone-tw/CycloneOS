# Discord Bot 指令系統設計

> Date: 2026-04-08
> Status: Draft
> Scope: Bot 指令（`/context`, `/session-log`, `/new`）+ 重啟機制 + 任務日誌

---

## 背景

CycloneOS Discord bot 是透過 Claude Code `--channels plugin:discord` 啟動的 MCP bridge，常駐在 Mac Mini 的 tmux session。Bot 本身就是一個 Claude Code session，擁有完整的本地工具能力（檔案讀寫、Bash、git、Python 等）。

目前 bot 能回應自然語言訊息，但缺乏結構化的 session 管理指令。本設計新增三個指令，並建立雲端友善的重啟機制。

---

## 指令總覽

| 指令 | 功能 | 副作用 |
|------|------|--------|
| `/context` | Session 健康檢查 | 無 |
| `/session-log` | 寫 bot 任務日誌 | 寫入 Obsidian |
| `/new` | 寫日誌 → handoff → 通知 → 重啟 | 寫入 Obsidian + exit |

---

## 1. `/context` — Session 健康檢查

### 功能

回傳當前 bot session 的運行狀態，讓使用者判斷是否需要重啟。

### 資料來源

| 欄位 | 來源 | 方法 |
|------|------|------|
| 運行時間 | Bot 啟動時間 vs 現在 | Session 內部追蹤 |
| 已處理訊息數 | Bot 內部計數 | Session 內部追蹤 |
| 處理摘要 | Bot 內部記錄 | Session 內部追蹤 |
| Token 用量 / Context % | Claude Code status bar | `tmux capture-pane -t discord-bot -p` 解析 |

### Token 用量取得方式

```bash
tmux capture-pane -t discord-bot -p | grep -oE '[0-9]+K tok \| [0-9]+% ctx'
```

解析 status bar 中的精確數值（如 `122K tok | 5% ctx`），不做估算。

### 回傳格式

```
🤖 Bot Session 狀態
─────────────────
⏱ 運行時間：2h 34m
📨 已處理訊息：7 則
📋 處理摘要：
  • 共學團開團文草擬
  • YouTube 影片轉錄 x2
  • 社群發文生成（IG + FB）
🧠 Context：122K tok / 5% used
```

### Session 內部追蹤

Bot 在 session 存續期間維護一份內部紀錄：

- `session_start_time`: 啟動時間
- `message_count`: 已處理訊息數
- `task_log[]`: 每筆處理的摘要（時間 + 來源 + 內容 + 結果）

這些資料存在 Claude 的 conversation context 中，不需要外部檔案。每次處理完一則訊息，bot 自動在內部追加一筆紀錄。

---

## 2. `/session-log` — Bot 任務日誌

### 功能

將當前 session 的任務紀錄寫入 Obsidian，但不重啟。用途：中途存檔，或單純記錄。

### 儲存路徑

```
{OBSIDIAN_VAULT}/Discord/bot-logs/YYYY-MM-DD-bot-NN.md
```

- Vault 路徑依機器不同（已存 memory）
- 編號用 Glob 確認：`Glob("YYYY-MM-DD-bot-*.md")` → 取下一個編號
- 與 CycloneOS session log 完全分離

### 日誌格式

```markdown
---
type: bot-log
date: 2026-04-08
session: 1
duration: 2h 34m
message-count: 7
token-usage: 122K
context-pct: 5%
---

# Bot Log 2026-04-08 #1

## 處理紀錄

| 時間 | 來源 | 請求摘要 | 結果 |
|------|------|---------|------|
| 09:12 | Cyclone (DM) | 共學團開團文草擬 | ✅ |
| 10:05 | Cyclone (DM) | YT 轉錄 https://... | ✅ |
| 10:45 | Cyclone (DM) | /context | ✅ |
| 11:30 | #general | 社群發文 IG+FB | ✅ |
| 13:00 | Cyclone (DM) | 文件分析 report.pdf | ❌ 檔案過大 |

## 統計
- 運行時間：2h 34m
- 處理訊息：7 則（✅ 6 / ❌ 1）
- Token 用量：122K / 5% context
```

### 寫入流程

1. `Glob("YYYY-MM-DD-bot-*.md")` → 確認編號（秒回）
2. `tmux capture-pane` → 取得精確 token 數據
3. 組合 session 內部追蹤的 task_log + token 數據
4. `Write` 直接寫入 Obsidian（不做 ls 確認）
5. Discord 回覆「✅ Bot log 已儲存」

---

## 3. `/new` — Session 重啟

### 功能

完整的 session 交接流程：寫日誌 → 生成 handoff → 通知 → 退出 → 自動重啟。

### 執行流程

```
使用者: /new
  │
  ├─ 1. 執行 /session-log（寫 bot 任務日誌）
  │
  ├─ 2. 生成 handoff 摘要（嵌入日誌末尾）
  │     - 未完成的任務
  │     - 需要注意的事項
  │     - 建議下個 session 做什麼
  │
  ├─ 3. Discord 回覆「🔄 Bot 重啟中，稍候 ~5 秒...」
  │
  └─ 4. exit(0)
        │
        ↓
  while-loop 偵測 exit → sleep 2s → 啟動新 session
```

### Handoff 格式（附加在日誌末尾）

```markdown
## Handoff

### 未完成任務
- （如有）

### 注意事項
- （如有）

### 建議下次優先處理
- （如有）
```

---

## 4. 重啟機制 — While-Loop Wrapper

### 設計原則

**Bot 只管退出，重啟交給外層 orchestrator。**

這確保本地和雲端的遷移零改動：
- 本地：tmux while-loop
- 雲端：Docker `restart: always` / K8s restartPolicy

### 啟動腳本

`scripts/discord-bot.sh`:

```bash
#!/bin/bash
export PATH="$HOME/.nvm/versions/node/v24.14.0/bin:/opt/homebrew/bin:$PATH"

# Kill existing session if any
tmux kill-session -t discord-bot 2>/dev/null

tmux new-session -d -s discord-bot -c "$HOME/CycloneOS" '
while true; do
  echo "[$(date)] Starting Discord bot..."
  claude --channels plugin:discord@claude-plugins-official \
    --dangerously-skip-permissions --model sonnet
  EXIT_CODE=$?
  echo "[$(date)] Bot exited with code $EXIT_CODE, restarting in 2s..."
  sleep 2
done
'

echo "Discord bot started in tmux session 'discord-bot'"
```

### 雲端遷移

```dockerfile
# Dockerfile（未來）
FROM node:24
# ... install claude cli ...
CMD ["claude", "--channels", "plugin:discord@claude-plugins-official", \
     "--dangerously-skip-permissions", "--model", "sonnet"]
```

```yaml
# docker-compose.yml
services:
  discord-bot:
    build: .
    restart: always
    working_dir: /app
```

Bot 程式碼完全不變，只是外層 orchestrator 從 tmux while-loop 換成 Docker restart policy。

---

## 5. 指令識別機制

### 方式

Bot 在收到 Discord 訊息時，檢查訊息是否以 `/` 開頭且匹配已知指令。這不是 Discord Slash Command 系統，而是 **文字比對**。

### 識別規則

Bot 的 system prompt / CLAUDE.md 中加入指令識別規則：

```
收到 Discord 訊息時：
- 若訊息為 "/context" → 執行 context 回報流程
- 若訊息為 "/session-log" → 執行 bot 日誌寫入流程
- 若訊息為 "/new" → 執行重啟流程
- 否則 → 正常處理訊息
```

指令不區分大小寫，可帶額外參數（預留擴充）。

---

## 6. Bot 能力範圍

Bot 作為 Claude Code session，直接使用本地 skill 處理工作，不需呼叫 Dashboard API：

| 能力 | 實作方式 |
|------|---------|
| 社群發文生成 | LLM 直接生成，Write 寫檔 |
| 簡報製作 | 本地生成 outline + slides |
| YouTube 轉錄 | whisper + LLM 摘要 |
| 文件處理 | 讀檔 + LLM 分析 |
| 資訊查詢 | 讀 Obsidian / git log / Notion |

Dashboard 和 Discord bot 是兩個獨立入口，共用底層的本地工具能力。

---

## 7. Bot 專用 CLAUDE.md（獨立工作目錄）

### 設計原則

Bot 使用獨立於 CycloneOS 的工作目錄，避免讀取開發用的 CLAUDE.md（特推會、IEP 面板等無關內容）。

### 目錄結構

```
~/discord-bot/              ← Bot 工作目錄（不在 CycloneOS git repo 內）
  CLAUDE.md                 ← Bot 專用規則（輕量）

~/CycloneOS/
  discord-bot/
    CLAUDE.md               ← Bot CLAUDE.md 的 source（version controlled）
  scripts/
    discord-bot.sh          ← 啟動腳本，working dir 指向 ~/discord-bot/
```

### Bot CLAUDE.md 內容範圍

只包含 bot 需要的規則：
- Discord Bot 行為規則（👀 / ✅ / ❌ reaction、繁體中文回覆）
- Session 追蹤規則
- 指令識別與執行規則（`/context`、`/session-log`、`/new`）
- Obsidian vault 路徑
- 寫入流程（Glob + Write，禁 Bash ls）

**不包含：**
- 🔜 Next Session handoff block
- 教育工作站、特推會、IEP 面板等開發細節
- Commit Protocol（bot 不做 git commit）
- QMD 記憶系統（bot 不一定需要）
- AI Agent 無關性原則（bot 不寫 CycloneOS 程式碼）

### 部署方式

```bash
# 首次 setup 或更新 bot config
cp ~/CycloneOS/discord-bot/CLAUDE.md ~/discord-bot/CLAUDE.md
```

### 雲端遷移

```dockerfile
COPY discord-bot/CLAUDE.md /app/CLAUDE.md
WORKDIR /app
CMD ["claude", "--channels", "plugin:discord@...", "--model", "sonnet"]
```

Container 直接用 repo 裡的 `discord-bot/CLAUDE.md`，不需要額外設定。

---

## 8. 需要變更的檔案

| 檔案 | 動作 | 說明 |
|------|------|------|
| `scripts/discord-bot.sh` | Modify | 改為 while-loop wrapper + working dir 改 `~/discord-bot/` |
| `discord-bot/CLAUDE.md` | Create | Bot 專用 CLAUDE.md（version controlled source） |
| `CLAUDE.md` | Modify | 移除 bot 規則（已搬到 bot 專用檔案） |
| `~/discord-bot/CLAUDE.md` | Deploy | 從 repo 複製到 bot 工作目錄（首次 setup） |
| Obsidian `Discord/bot-logs/` | Auto-create | 首次寫入時自動建立 |

### 不需要新增的程式碼

- 無新的 API routes
- 無新的前端元件
- 無新的 npm packages

所有邏輯透過 Bot 專用 CLAUDE.md 行為規則 + Claude Code 本地工具實現。

---

## 8. 測試計畫

| 測試項目 | 方法 |
|---------|------|
| `/context` 回傳正確 | 啟動 bot → 處理幾則訊息 → `/context` → 確認數據 |
| Token 數據準確 | 比對 `/context` 回報值與 tmux status bar |
| `/session-log` 寫入正確 | 執行 → 確認 Obsidian 檔案存在且格式正確 |
| `/new` 完整流程 | 執行 → 確認日誌寫入 → 確認 Discord 通知 → 確認 bot 重啟 |
| While-loop 重啟 | Bot exit 後確認自動重開 |
| 編號不衝突 | 同日多次 `/session-log` → 確認編號遞增 |
