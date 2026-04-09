# Discord Slash Commands — 設計文件

> 日期：2026-04-09
> 狀態：Draft
> 前置：2026-04-08 Discord Bot Commands Design（spec + plan）

## 背景

CycloneOS Discord Bot 使用 Claude Code 官方 Discord plugin（MCP server）。Plugin 只處理普通文字訊息（`messageCreate`），不處理 Discord Interaction（slash commands）。使用者希望 bot 像其他 Discord bot 一樣，在 `/` 選單中顯示專屬指令。

## 問題

1. Discord slash commands 走 Interaction 機制，不是普通訊息
2. Plugin 的 `interactionCreate` handler 只處理 button clicks，忽略 application commands
3. Plugin 是 Claude Code 官方套件（`~/.claude/plugins/cache/`），修改會被更新覆蓋

## 設計決策

### 為什麼用獨立 companion script 而非改 plugin？

| 考量 | 改 Plugin (方案 B) | Companion Script (方案 A) |
|------|-------------------|--------------------------|
| Plugin 更新 | 覆蓋修改，需重新 patch | 不受影響 |
| 回應速度 | 經過 LLM（數秒） | 直接程式碼回覆（<100ms） |
| Token 消耗 | 佔用 bot context | 零 token |
| 雲端部署 | 需維護 custom image | 獨立 container |
| 可靠性 | 依賴 LLM 行為 | 確定性程式碼 |

### 為什麼用 Hook 追蹤 state 而非靠 CLAUDE.md 指示？

CLAUDE.md 指示 bot「每次回覆後寫 state file」是 LLM 指令，不保證執行。
Claude Code Hook 是工具層觸發，reply/react 工具一被呼叫就自動執行 shell script，100% 可靠。

---

## 架構

```
┌──────────────────────┐      ┌───────────────────────┐
│  Claude Code Bot     │      │  Slash Handler         │
│  (tmux: discord-bot) │      │  (Bun 獨立 process)    │
│                      │      │                        │
│  Discord Plugin      │      │  discord.js client     │
│  ↓ messageCreate     │      │  ↓ interactionCreate   │
│  → MCP notification  │      │                        │
│  → LLM 處理          │      │  讀取:                  │
│                      │      │  - .bot-activity.jsonl  │
│  PostToolUse hooks ──────→  │  - .bot-startup.json    │
│  (reply, react)      │      │  - tmux capture-pane    │
│  寫入 activity log   │      │                        │
└──────────────────────┘      └───────────────────────┘
         │                              │
         └───────── Discord API ────────┘
              (同一個 bot token)
```

### 資料流

1. **Bot 處理訊息** → Plugin 收到 message → Claude Code 處理 → 用 `reply` 工具回覆
2. **Hook 自動觸發** → `PostToolUse` hook 攔截 reply/react → 從 stdin 讀取 tool_input → 追加到 `.bot-activity.jsonl`
3. **使用者打 slash command** → Discord 送 Interaction → Slash Handler 處理 → 讀 state files → 直接回覆 Interaction

Bot 和 Slash Handler **不直接通訊**，透過檔案系統共享 state。

---

## 共享 State 檔案

所有 state 檔案存放在 `~/discord-bot/`。

### `.bot-startup.json`

Bot 每次啟動時由 `discord-bot.sh` 寫入：

```json
{
  "startedAt": "2026-04-09T11:08:52+08:00",
  "version": "2.1.97"
}
```

- `startedAt`：while-loop 每次迭代開始前寫入
- `version`：從 `claude --version` 取得

### `.bot-activity.jsonl`

Hook 自動追加，每行一筆 JSON：

```jsonl
{"ts":"2026-04-09T11:10:23+08:00","tool":"reply","chat_id":"123456","text":"回覆內容...","message_id":"789"}
{"ts":"2026-04-09T11:10:25+08:00","tool":"react","chat_id":"123456","message_id":"456","emoji":"✅"}
```

欄位說明：
- `ts`：hook 執行時的 ISO 8601 時間戳
- `tool`：`reply` 或 `react`
- `chat_id`：Discord channel ID
- `text`：回覆內容（僅 reply）
- `message_id`：訊息 ID（reply 時為 bot 送出的 message ID，react 時為被 react 的 message ID）
- `emoji`：emoji 字元（僅 react）

生命週期：
- Bot 啟動時清空（`discord-bot.sh` 負責）
- `/new` 指令觸發時，slash handler 先讀取完寫入 session-log，再由 bot 重啟時清空

---

## Hook 配置

### 位置

`~/discord-bot/.claude/settings.json`（需先 `git init ~/discord-bot`）

如果 Claude Code 在非 git 目錄不載入 project settings，備案是放 `~/.claude/settings.json`（全域），因為只有 bot session 會呼叫 Discord reply/react 工具。

### 設定內容

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "mcp__plugin_discord_discord__reply",
        "hooks": [
          {
            "type": "command",
            "command": "$HOME/discord-bot/hooks/log-activity.sh",
            "timeout": 5
          }
        ]
      },
      {
        "matcher": "mcp__plugin_discord_discord__react",
        "hooks": [
          {
            "type": "command",
            "command": "$HOME/discord-bot/hooks/log-activity.sh",
            "timeout": 5
          }
        ]
      }
    ]
  }
}
```

### Hook Script: `discord-bot/hooks/log-activity.sh`

```bash
#!/bin/bash
# 從 stdin 讀取 hook payload，擷取關鍵欄位，追加到 activity log
LOG_FILE="$HOME/discord-bot/.bot-activity.jsonl"
INPUT=$(cat)

TOOL=$(echo "$INPUT" | jq -r '.tool_name // empty' | sed 's/.*__//')
TS=$(date -u +"%Y-%m-%dT%H:%M:%S%z")
CHAT_ID=$(echo "$INPUT" | jq -r '.tool_input.chat_id // empty')
TEXT=$(echo "$INPUT" | jq -r '.tool_input.text // empty')
MSG_ID=$(echo "$INPUT" | jq -r '.tool_input.message_id // empty')
EMOJI=$(echo "$INPUT" | jq -r '.tool_input.emoji // empty')

# reply 的 tool_response 格式為 MCP content: [{type:"text", text:"sent (id: 123456)"}]
# 從中解析 message_id
if [ "$TOOL" = "reply" ]; then
  RESP_TEXT=$(echo "$INPUT" | jq -r '.tool_response.content[0].text // empty')
  RESP_MSG_ID=$(echo "$RESP_TEXT" | grep -oE 'id: ([0-9]+)' | head -1 | cut -d' ' -f2)
  [ -n "$RESP_MSG_ID" ] && MSG_ID="$RESP_MSG_ID"
fi

jq -nc \
  --arg ts "$TS" \
  --arg tool "$TOOL" \
  --arg chat_id "$CHAT_ID" \
  --arg text "$TEXT" \
  --arg message_id "$MSG_ID" \
  --arg emoji "$EMOJI" \
  '{ts:$ts, tool:$tool, chat_id:$chat_id} + 
   (if $text != "" then {text:$text} else {} end) +
   (if $message_id != "" then {message_id:$message_id} else {} end) +
   (if $emoji != "" then {emoji:$emoji} else {} end)' >> "$LOG_FILE"
```

---

## Slash Handler

### 技術選型

- **Runtime**: Bun（Mac Mini 已安裝，啟動快）
- **Discord library**: discord.js 14（與 plugin 一致）
- **檔案位置**: `CycloneOS/discord-bot/slash-handler.ts`
- **Dependencies**: `discord-bot/package.json`（獨立於 CycloneOS 主 package.json）

### Discord Gateway 連線

同一個 bot token 建立第二條 gateway 連線。小型 bot（<100 servers）不會有問題。Slash handler 只需要 `Guilds` intent（最小權限）。

### 指令處理

#### `/context` — Session 健康檢查

流程：
1. 讀 `.bot-startup.json` → 計算運行時間
2. 讀 `.bot-activity.jsonl` → 計算訊息數 + 最近任務摘要
3. 執行 `tmux capture-pane -t discord-bot -p` → 解析 token 數據（`XXK tok` / `X% ctx`）
4. 格式化回覆：

```
🤖 Bot Session 狀態
─────────────────
⏱ 運行時間：2h 15m
📨 已處理訊息：7 則
📋 最近處理：
  • ✅ 查詢今日行事曆
  • ✅ 搜尋 Obsidian 筆記
  • ❌ 圖片辨識失敗
🧠 Context：45K tok / 23% used
```

訊息數計算邏輯：
- 計算 `.bot-activity.jsonl` 中 `tool == "reply"` 的不重複 `chat_id + 前一筆 message` 組合數
- 簡化版：直接數 reply 行數（一則訊息可能有多次 reply，但作為近似值足夠）

最近處理的摘要邏輯：
- 取最近 5 筆 reply
- 每筆取 text 前 30 字 + 對應的 react emoji（✅/❌）作為結果標記
- react 關聯方式：reply 後 2 秒內同 chat_id 的 react

Token 數據解析（tmux）：
- 正則：`/(\d+(?:\.\d+)?[KM])\s*tok/` 和 `/(\d+)%\s*(?:ctx|context)/`
- tmux 不可用時（雲端）：顯示「N/A（非 tmux 環境）」

#### `/session-log` — 寫 Bot 任務日誌

流程：
1. 讀 `.bot-startup.json` + `.bot-activity.jsonl`
2. 執行 `tmux capture-pane -t discord-bot -p` → 解析 token 數據（寫入 frontmatter）
3. 計算統計數據（運行時間、訊息數、成功/失敗數）
4. 組裝 Obsidian markdown（格式同 `discord-bot/CLAUDE.md` 定義的模板）
5. 找到 Obsidian vault 路徑（環境變數 `OBSIDIAN_VAULT`）
6. 確認 `Discord/bot-logs/` 目錄存在，計算下一個編號（`YYYY-MM-DD-bot-NN.md`）
7. 寫入檔案
8. 回覆 interaction：`✅ Bot log 已儲存：2026-04-09-bot-01.md`

日誌格式（與 `discord-bot/CLAUDE.md` 一致）：

```markdown
---
type: bot-log
date: 2026-04-09
session: 1
duration: 2h 15m
message-count: 7
token-usage: 45K
context-pct: 23%
---

# Bot Log 2026-04-09 #1

## 處理紀錄

| 時間 | 摘要 | 結果 |
|------|------|------|
| 11:10 | 查詢今日行事曆 | ✅ |
| 11:23 | 搜尋 Obsidian 筆記 | ✅ |
| 11:45 | 圖片辨識 | ❌ |

## 統計
- 運行時間：2h 15m
- 處理訊息：7 則（✅ 6 / ❌ 1）
- Token 用量：45K / 23% context
```

#### `/new` — Session 重啟

流程：
1. 執行 `/session-log` 完整流程（寫 Obsidian 日誌）
2. 回覆 interaction：`🔄 Bot 重啟中，稍候 ~5 秒...`
3. 等待 1 秒（確保 Discord 回覆送出）
4. 執行 `tmux send-keys -t discord-bot '/exit' Enter`
5. while-loop 自動重啟 bot，`.bot-activity.jsonl` 在啟動時被清空

---

## Process 管理

### `scripts/discord-bot.sh` 更新

```bash
#!/bin/bash
export PATH="$HOME/.nvm/versions/node/v24.14.0/bin:/opt/homebrew/bin:$PATH"

BOT_DIR="$HOME/discord-bot"
REPO_DIR="$HOME/CycloneOS"
HANDLER_DIR="$REPO_DIR/discord-bot"

# 環境變數
export DISCORD_BOT_TOKEN=$(grep DISCORD_BOT_TOKEN "$HOME/.claude/channels/discord/.env" | cut -d= -f2-)
export OBSIDIAN_VAULT=$(find "$HOME/Library/CloudStorage" -maxdepth 3 -name "Obsidian-Cyclone" -type d 2>/dev/null | head -1)

# 準備 bot 工作目錄
mkdir -p "$BOT_DIR/.claude"
cp "$REPO_DIR/discord-bot/CLAUDE.md" "$BOT_DIR/CLAUDE.md"

# 初始化 git repo（hook settings 需要）
if [ ! -d "$BOT_DIR/.git" ]; then
  git -C "$BOT_DIR" init -q
fi

# 複製 hook settings + script
cp "$REPO_DIR/discord-bot/settings.json" "$BOT_DIR/.claude/settings.json"
mkdir -p "$BOT_DIR/hooks"
cp "$REPO_DIR/discord-bot/hooks/log-activity.sh" "$BOT_DIR/hooks/"
chmod +x "$BOT_DIR/hooks/log-activity.sh"

# 安裝 slash handler dependencies（如有更新）
cd "$HANDLER_DIR" && bun install --frozen-lockfile 2>/dev/null || bun install

# Kill 舊 sessions
tmux kill-session -t discord-bot 2>/dev/null
tmux kill-session -t slash-handler 2>/dev/null

# 啟動 slash handler（獨立 tmux session）
tmux new-session -d -s slash-handler -c "$HANDLER_DIR" \
  "DISCORD_BOT_TOKEN=$DISCORD_BOT_TOKEN OBSIDIAN_VAULT=$OBSIDIAN_VAULT BOT_DIR=$BOT_DIR bun run slash-handler.ts"

# 啟動 bot（while-loop）
tmux new-session -d -s discord-bot -c "$BOT_DIR" "
while true; do
  echo \"[\$(date)] Starting Discord bot...\"
  # 寫 startup state
  echo '{\"startedAt\":\"'\$(date -u +%Y-%m-%dT%H:%M:%S%z)'\",\"version\":\"'\$(claude --version 2>/dev/null | head -1)'\"}' > \"$BOT_DIR/.bot-startup.json\"
  # 清空 activity log
  > \"$BOT_DIR/.bot-activity.jsonl\"
  claude --channels plugin:discord@claude-plugins-official \\
    --dangerously-skip-permissions --model sonnet
  EXIT_CODE=\$?
  echo \"[\$(date)] Bot exited with code \$EXIT_CODE, restarting in 2s...\"
  sleep 2
done
"

echo "Discord bot started in tmux session 'discord-bot'"
echo "Slash handler started in tmux session 'slash-handler'"
```

---

## 檔案結構

```
CycloneOS/
├── discord-bot/
│   ├── CLAUDE.md              # Bot 專用規則（已存在）
│   ├── package.json           # slash handler dependencies（新建）
│   ├── slash-handler.ts       # Slash command handler（新建）
│   ├── settings.json          # Hook 設定，部署時複製到 ~/discord-bot/.claude/（新建）
│   └── hooks/
│       └── log-activity.sh    # Activity logging hook script（新建）
├── scripts/
│   └── discord-bot.sh         # 啟動腳本（修改）
```

部署目錄：
```
~/discord-bot/
├── .git/                      # git init（讓 project settings 生效）
├── .claude/
│   └── settings.json          # 從 repo 複製的 hook 設定
├── hooks/
│   └── log-activity.sh        # 從 repo 複製的 hook script
├── CLAUDE.md                  # 從 repo 複製
├── .bot-startup.json          # 啟動時寫入
└── .bot-activity.jsonl        # Hook 自動追加
```

---

## CLAUDE.md 更新

`discord-bot/CLAUDE.md` 新增一段，告知 bot slash commands 已由外部 handler 處理：

```markdown
## Slash Commands（外部處理）

`/context`、`/session-log`、`/new` 由獨立的 slash handler 處理，不會進入此 session。
如果使用者在一般訊息中提到這些指令（非 slash command），可以告知他們使用 `/` 選單。
```

---

## 雲端遷移對照

| 元件 | 本地 | 雲端 | 改動 |
|------|------|------|------|
| Bot process | tmux while-loop | Docker `restart: always` | 刪 tmux 相關 |
| Slash handler | tmux session | 獨立 container | 無 |
| State 共享 | `~/discord-bot/` 檔案 | Docker shared volume | 改路徑為環境變數 |
| Token 數據 | `tmux capture-pane` | 顯示 N/A 或估算 | graceful fallback |
| Obsidian 寫入 | CloudStorage 路徑 | mounted volume 或 Notion API | `OBSIDIAN_VAULT` 環境變數 |
| Bot token | `~/.claude/channels/discord/.env` | container env var | 已用環境變數 |
| Hook settings | `~/discord-bot/.claude/settings.json` | container 內 `.claude/settings.json` | 路徑調整 |

核心程式碼零改動，只換環境配置。

---

## 錯誤處理

| 情境 | 行為 |
|------|------|
| Slash handler 掛了 | Slash commands 失敗，bot 正常運作。使用者可直接打字跟 bot 互動 |
| Bot 掛了（重啟中） | Slash handler 正常。`/context` 顯示最後已知狀態，`/new` 的 tmux send-keys 無效果但不會 crash |
| `.bot-activity.jsonl` 不存在 | `/context` 顯示「無活動記錄」，`/session-log` 寫入空日誌 |
| `.bot-startup.json` 不存在 | `/context` 運行時間顯示「未知」 |
| tmux 不可用 | Token 數據顯示「N/A」 |
| Obsidian vault 路徑不存在 | `/session-log` 回覆錯誤訊息，不 crash |
| 兩條 gateway 衝突 | 極低機率（小型 bot）。如發生，slash handler 自動重連 |

---

## 測試計畫

1. **Hook 驗證**：啟動 bot → 發訊息讓 bot 回覆 → 檢查 `.bot-activity.jsonl` 有新行
2. **`/context`**：呼叫 → 確認顯示正確的運行時間、訊息數、token 數據
3. **`/session-log`**：呼叫 → 確認 Obsidian `Discord/bot-logs/` 有新檔案、格式正確
4. **`/new`**：呼叫 → 確認寫日誌 + bot 重啟 + 重啟後 activity log 是空的
5. **Edge cases**：bot 未啟動時呼叫 `/context`、連續呼叫 `/new` 兩次
