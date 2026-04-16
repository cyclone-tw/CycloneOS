---
name: discord-bot-ops
description: "Discord Bot 部署、維護、除錯 SOP。操作 discord-bot/ 或處理 Bot 相關問題時自動載入。"
user-invocable: false
---

# Discord Bot 運維手冊

CycloneOS 的 Discord Bot 是一個 Claude Code instance，透過 Discord plugin 接收/回覆訊息。

---

## 架構

```
CycloneOS/
├── discord-bot/CLAUDE.md    ← Bot 專用行為規則
└── scripts/
    ├── discord-bot.sh       ← tmux while-loop 啟動腳本
    └── discord-bot-run.sh   ← 內部執行腳本
```

Bot 工作目錄：`~/discord-bot/`（與 CycloneOS repo 隔離）

---

## 啟動流程

```bash
bash scripts/discord-bot.sh
```

腳本做三件事：
1. 建立 `~/discord-bot/`，從 repo 複製最新 `discord-bot/CLAUDE.md`
2. 清除舊 tmux session：`tmux kill-session -t discord-bot`
3. 啟動 tmux + while-loop：

```bash
while true; do
  claude --channels plugin:discord@claude-plugins-official \
    --dangerously-skip-permissions --model sonnet
  sleep 2  # crash 後 2 秒自動重啟
done
```

---

## Session 管理（Bot 端）

Bot 沒有持久化 session 狀態，全部在 conversation context 中追蹤：

| 追蹤項 | 說明 |
|--------|------|
| 啟動時間 | 第一則訊息時記錄 |
| 訊息計數 | 每處理一則 +1 |
| 任務日誌 | `{時間, 來源, 摘要, ✅/❌}` |

三個指令控制生命週期：
- `/context` — 回報狀態（運行時間、訊息數、token 用量）
- `/session-log` — 寫日誌到 Obsidian，不重啟
- `/new` — 寫日誌 → 通知 → 結束（while-loop 自動重啟）

---

## 常見維護操作

### 查看 Bot 狀態
```bash
tmux attach -t discord-bot    # 進入 tmux session
# Ctrl+B D 離開 tmux（不會關 bot）
```

### 手動重啟
```bash
tmux kill-session -t discord-bot
bash scripts/discord-bot.sh
```

### 更新 Bot 規則
1. 修改 `discord-bot/CLAUDE.md`
2. Commit + push
3. 在 Mac Mini：`git pull` → 重啟 bot（腳本會自動複製最新 CLAUDE.md）

### 查看 Bot 日誌
Obsidian: `Discord/bot-logs/YYYY-MM-DD-bot-NN.md`

---

## 安全邊界

- `--dangerously-skip-permissions` = Bot 可執行任何 shell 指令
- 行為限制完全依賴 `discord-bot/CLAUDE.md` 的軟性規則
- Bot 能寫入 Obsidian Vault（用 Glob + Write，禁 Bash ls/find）
- Bot 只用繁體中文回覆
- 收到訊息自動加 👀，完成後加 ✅ 或 ❌

---

## 修改注意

- Bot 規則改 `discord-bot/CLAUDE.md`，不是主 CLAUDE.md
- Bot 工作目錄是 `~/discord-bot/`，不是 CycloneOS repo
- Token 數據可透過 `tmux capture-pane -t discord-bot -p` 讀取 status bar
