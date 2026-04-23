# Discord Bot 指令系統 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 為 Discord bot 新增 `/context`、`/session-log`、`/new` 三個指令，建立 Bot 專用 CLAUDE.md + 雲端友善的 while-loop 重啟機制。

**Architecture:** Bot 使用獨立工作目錄 `~/discord-bot/`（不在 CycloneOS git repo 內），搭配專用輕量 CLAUDE.md。所有指令邏輯透過 CLAUDE.md 行為規則定義。啟動腳本改為 while-loop wrapper，bot exit 後自動重開。

**Tech Stack:** Bash (tmux)、CLAUDE.md 行為規則、Obsidian Markdown

---

## File Map

| 檔案 | 動作 | 職責 |
|------|------|------|
| `discord-bot/CLAUDE.md` | Create | Bot 專用 CLAUDE.md source（version controlled） |
| `scripts/discord-bot.sh` | Modify | While-loop wrapper + working dir 改 `~/discord-bot/` |
| `CLAUDE.md` | Modify | 移除 Discord Bot 行為規則（已搬到 bot 專用檔案） |

部署時 `discord-bot/CLAUDE.md` 複製到 `~/discord-bot/CLAUDE.md`。Obsidian `Discord/bot-logs/` 目錄在首次寫入時由 bot 自動建立。

---

### Task 1: 建立 Bot 專用 CLAUDE.md

**Files:**
- Create: `discord-bot/CLAUDE.md`

- [ ] **Step 1: 建立 `discord-bot/` 目錄**

```bash
mkdir -p discord-bot
```

- [ ] **Step 2: 建立 `discord-bot/CLAUDE.md`**

寫入以下完整內容：

```markdown
# Discord Bot 設定

## 行為規則

收到訊息時系統自動加 👀。任務結束後用 `react` 工具加：✅ 完成 / ❌ 失敗。

- 用繁體中文回覆，簡潔直接
- 失敗時說明原因，不要沉默不回應
- 簡單問題直接回答，不需要抓連結或做深度研究

## Session 追蹤

Bot 在 session 存續期間，必須在 conversation context 中維護以下紀錄：

- **啟動時間**：收到第一則訊息時記錄當下時間作為 session 開始時間
- **訊息計數**：每處理一則 Discord 訊息（不含自己的回覆），計數 +1
- **任務日誌**：每筆處理完成後，記錄一筆 `{時間, 來源, 摘要, 結果(✅/❌)}`

## 指令

收到 Discord 訊息時，先檢查是否為指令（以 `/` 開頭，不區分大小寫）：

### `/context` — Session 健康檢查

回傳當前 session 狀態，用以下格式回覆 Discord：

```
🤖 Bot Session 狀態
─────────────────
⏱ 運行時間：Xh Ym
📨 已處理訊息：N 則
📋 處理摘要：
  • 任務1
  • 任務2
🧠 Context：XXK tok / X% used
```

**Token 數據取得方式**：執行 `tmux capture-pane -t discord-bot -p` 並解析 status bar 中的 `XXK tok` 和 `X% ctx` 數值。

### `/session-log` — 寫 Bot 任務日誌

將 session 追蹤紀錄寫入 Obsidian，不重啟。

**寫入路徑**：`{OBSIDIAN_VAULT}/Discord/bot-logs/YYYY-MM-DD-bot-NN.md`

- 用 `Glob("YYYY-MM-DD-bot-*.md")` 確認下一個編號
- 用 `Write` 直接寫入，不做 `ls` 確認

**日誌模板**：

```
---
type: bot-log
date: YYYY-MM-DD
session: N
duration: Xh Ym
message-count: N
token-usage: XXXK
context-pct: X%
---

# Bot Log YYYY-MM-DD #N

## 處理紀錄

| 時間 | 來源 | 請求摘要 | 結果 |
|------|------|---------|------|
| HH:MM | 來源 | 摘要 | ✅/❌ |

## 統計
- 運行時間：Xh Ym
- 處理訊息：N 則（✅ X / ❌ Y）
- Token 用量：XXXK / X% context
```

寫入後回覆 Discord「✅ Bot log 已儲存：YYYY-MM-DD-bot-NN.md」

### `/new` — Session 重啟

依序執行：
1. 執行 `/session-log` 流程（寫 bot 任務日誌）
2. 在日誌末尾追加 Handoff 區塊：

```
## Handoff

### 未完成任務
- （如有）

### 注意事項
- （如有）

### 建議下次優先處理
- （如有）
```

3. Discord 回覆「🔄 Bot 重啟中，稍候 ~5 秒...」
4. 執行 `/exit` 結束 session（外層 while-loop 會自動重啟）

## Obsidian Vault 路徑

Bot 寫入 Obsidian 時，依執行機器使用對應路徑。首次執行時用 `Glob` 搜尋含 `Obsidian-Cyclone` 的 CloudStorage 路徑來定位。

寫入流程一律使用 `Glob` + `Write`，禁止用 Bash `ls`/`find` 探索雲端路徑。
```

- [ ] **Step 3: Commit**

```bash
git add discord-bot/CLAUDE.md
git commit -m "feat(discord): create bot-specific CLAUDE.md with command rules"
```

---

### Task 2: 改寫啟動腳本 + 部署 Bot CLAUDE.md

**Files:**
- Modify: `scripts/discord-bot.sh`

- [ ] **Step 1: 改寫 `scripts/discord-bot.sh`**

將整個檔案內容替換為：

```bash
#!/bin/bash
export PATH="$HOME/.nvm/versions/node/v24.14.0/bin:/opt/homebrew/bin:$PATH"

BOT_DIR="$HOME/discord-bot"
REPO_DIR="$HOME/CycloneOS"

# Ensure bot working directory exists with latest CLAUDE.md
mkdir -p "$BOT_DIR"
cp "$REPO_DIR/discord-bot/CLAUDE.md" "$BOT_DIR/CLAUDE.md"

# Kill existing session if any
tmux kill-session -t discord-bot 2>/dev/null

tmux new-session -d -s discord-bot -c "$BOT_DIR" '
while true; do
  echo "[$(date)] Starting Discord bot..."
  claude --channels plugin:discord@claude-plugins-official \
    --dangerously-skip-permissions --model sonnet
  EXIT_CODE=$?
  echo "[$(date)] Bot exited with code $EXIT_CODE, restarting in 2s..."
  sleep 2
done
'

echo "Discord bot started in tmux session '\''discord-bot'\''"
```

- [ ] **Step 2: 驗證腳本語法**

```bash
bash -n scripts/discord-bot.sh
```

Expected: 無輸出（無語法錯誤）

- [ ] **Step 3: Commit**

```bash
git add scripts/discord-bot.sh
git commit -m "feat(discord): while-loop wrapper + separate bot working directory"
```

---

### Task 3: 清理主 CLAUDE.md 的 Bot 規則

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: 將 CLAUDE.md 中的 `## Discord Bot 行為規則` 區塊替換為指向 bot 專用檔案的說明**

找到：

```markdown
## Discord Bot 行為規則

收到訊息時系統自動加 👀。任務結束後用 `react` 工具加：✅ 完成 / ❌ 失敗。

- 用繁體中文回覆，簡潔直接
- 失敗時說明原因，不要沉默不回應
```

替換為：

```markdown
## Discord Bot

Bot 使用獨立工作目錄和專用 CLAUDE.md，規則定義在 `discord-bot/CLAUDE.md`。

啟動：`bash scripts/discord-bot.sh`（tmux while-loop，auto-restart）
```

- [ ] **Step 2: 確認 CLAUDE.md 格式正確**

讀取 CLAUDE.md 確認 markdown 格式無破損，新的 Discord Bot 區塊簡潔明瞭。

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "refactor(discord): move bot rules to dedicated discord-bot/CLAUDE.md"
```

---

### Task 4: 驗證 While-Loop 重啟機制

**注意：此 Task 需在 Mac Mini 上執行。**

- [ ] **Step 1: 啟動 bot**

```bash
bash scripts/discord-bot.sh
```

Expected: 輸出 `Discord bot started in tmux session 'discord-bot'`

- [ ] **Step 2: 確認 tmux session 存在**

```bash
tmux ls
```

Expected: 顯示 `discord-bot: ...`

- [ ] **Step 3: 確認 bot 工作目錄和 CLAUDE.md**

```bash
ls ~/discord-bot/CLAUDE.md
```

Expected: 檔案存在

- [ ] **Step 4: 進入 tmux 確認 while-loop 正在運行**

```bash
tmux attach -t discord-bot
```

Expected: 看到 `[日期] Starting Discord bot...` 和 Claude Code 啟動畫面

- [ ] **Step 5: 測試自動重啟**

在 tmux 內，用 Ctrl+C 中斷 Claude Code process。

Expected:
1. 顯示 `[日期] Bot exited with code X, restarting in 2s...`
2. 2 秒後顯示 `[日期] Starting Discord bot...`
3. Claude Code 自動重新啟動

按 Ctrl+B 再按 D 離開 tmux。

---

### Task 5: 測試 Bot 指令（Discord 端）

**注意：此 Task 需在 Mac Mini 上執行，Bot 需已啟動。**

- [ ] **Step 1: 測試 `/context`**

在 Discord DM 發送：`/context`

Expected: Bot 回覆包含運行時間、訊息數（0-1）、context 數據的狀態報告。

- [ ] **Step 2: 發送幾則一般訊息**

發送 2-3 則一般任務訊息，讓 bot 處理。

- [ ] **Step 3: 再次測試 `/context`**

Expected: 訊息數應反映已處理的數量，處理摘要列出剛才的任務。

- [ ] **Step 4: 測試 `/session-log`**

在 Discord DM 發送：`/session-log`

Expected:
1. Bot 回覆「✅ Bot log 已儲存：2026-04-08-bot-01.md」
2. 確認檔案存在於 Obsidian `Discord/bot-logs/` 目錄
3. 檔案內容包含 frontmatter + 處理紀錄表格 + 統計

- [ ] **Step 5: 測試 `/new`**

在 Discord DM 發送：`/new`

Expected:
1. Bot 寫入日誌（含 Handoff 區塊）
2. Bot 回覆「🔄 Bot 重啟中，稍候 ~5 秒...」
3. Bot 斷線後幾秒內重新上線
4. 確認 Obsidian 日誌檔案存在且包含 Handoff

- [ ] **Step 6: 驗證重啟後 session 是乾淨的**

重啟後發送：`/context`

Expected: 運行時間很短、訊息數為 1（這則 /context 本身）、無歷史摘要。
