# CycloneOS Discord Bot — 部署與串接指南

> Claude Code × Discord Channel Plugin 實戰紀錄
> 最後更新：2026-04-04

---

## 目錄

1. [架構概覽](#架構概覽)
2. [前置需求](#前置需求)
3. [Step 1 — Discord Developer Portal 設定](#step-1--discord-developer-portal-設定)
4. [Step 2 — Mac Mini 環境設定](#step-2--mac-mini-環境設定)
5. [Step 3 — Bot Token 設定與配對](#step-3--bot-token-設定與配對)
6. [Step 4 — 啟動與常駐部署](#step-4--啟動與常駐部署)
7. [存取控制與頻道設定](#存取控制與頻道設定)
8. [檔案結構](#檔案結構)
9. [常用管理指令](#常用管理指令)
10. [踩坑紀錄與試誤過程](#踩坑紀錄與試誤過程)

---

## 架構概覽

```
Discord 使用者
    ↓ 訊息
Discord Server
    ↓ WebSocket
Discord Plugin (MCP Server, bun)
    ↓ stdin/stdout
Claude Code CLI (tmux session)
    ↓ 讀寫
CycloneOS 專案目錄 (~/CycloneOS)
```

- **Discord Plugin** 是 Claude Code 的官方 channel plugin，作為 MCP server 運行
- **Claude Code CLI** 以互動模式啟動，透過 `--channels` 接收 Discord 訊息
- Bot 的工作目錄設為 CycloneOS，因此它可以讀寫專案檔案、執行指令

---

## 前置需求

| 項目 | 版本 | 安裝方式 |
|------|------|----------|
| macOS | 任意 | — |
| Node.js | >= 18 | `nvm install 24` |
| Bun | >= 1.0 | `curl -fsSL https://bun.sh/install \| bash` |
| Claude Code CLI | >= 2.1.91 | `npm install -g @anthropic-ai/claude-code` |
| tmux | 任意 | `brew install tmux` |
| Claude 帳號 | Max 或 API 方案 | claude.ai 登入認證 |

### 確認安裝

```bash
node --version    # v24.x
bun --version     # 1.x
claude --version  # 2.1.91+
tmux -V           # tmux 3.x
claude auth status  # loggedIn: true
```

---

## Step 1 — Discord Developer Portal 設定

### 1.1 建立 Application

1. 前往 [Discord Developer Portal](https://discord.com/developers/applications)
2. 點「New Application」→ 取名（例如 `CycloneOS`）

### 1.2 設定 Bot

進入 Bot 頁面：

| 設定 | 值 |
|------|-----|
| 公開機器人 | 開或關（關掉 = 只有你能邀請） |
| 需要 OAuth2 代碼授權 | 關 |
| Presence Intent | 關 |
| Server Members Intent | 關 |
| **Message Content Intent** | **開啟（必要）** |

點 **Reset Token** → 複製保存 Bot Token（只顯示一次）。

### 1.3 設定 OAuth2 並邀請 Bot

1. 前往 OAuth2 → URL Generator
2. **Scopes** 勾選 `bot`
3. **Bot Permissions** 勾選：
   - View Channels
   - Send Messages
   - Read Message History
   - Attach Files
   - Add Reactions
   - Create Public Threads
   - Create Private Threads
   - Send Messages in Threads
4. **整合類型**選「公會安裝」
5. 複製產生的 URL，在瀏覽器打開，選擇 server 並授權

---

## Step 2 — Mac Mini 環境設定

### 2.1 安裝 Discord Plugin

```bash
claude plugin install discord@claude-plugins-official
```

### 2.2 確認 Claude Code 認證

```bash
claude auth status
```

確保 `loggedIn: true`。

> **重要：** 如果 `~/.zshrc` 中有設定 `ANTHROPIC_API_KEY` 環境變數，
> 且該 key 無效，Claude Code 會優先使用它而非 claude.ai 登入認證，
> 導致所有 API 呼叫失敗（錯誤：`Invalid API key`）。
> 移除該環境變數即可解決。

---

## Step 3 — Bot Token 設定與配對

### 3.1 設定 Token

在 Claude Code 互動模式中執行：

```bash
claude
# 進入後輸入：
/discord:configure <你的BOT_TOKEN>
```

Token 會存到 `~/.claude/channels/discord/.env`。

### 3.2 首次啟動與配對

開一個終端機：

```bash
cd ~/CycloneOS
claude --channels plugin:discord@claude-plugins-official
```

Bot 上線後：

1. 在 Discord **私訊 Bot**（發任意訊息）
2. Bot 回覆一個 pairing code（例如 `5f3e35`）
3. 回到另一個 Claude Code session，執行：
   ```
   /discord:access pair 5f3e35
   ```
4. 鎖定 allowlist（只允許你使用）：
   ```
   /discord:access policy allowlist
   ```

### 3.3 新增 Server 頻道

1. Discord 設定 → 進階 → 開啟**開發者模式**
2. 右鍵點頻道名稱 → 複製頻道 ID
3. 在 Claude Code 中執行：
   ```
   /discord:access guild-channel add <頻道ID>
   ```

如果要免 @mention 就能觸發：
```
/discord:access guild-channel add <頻道ID> --no-mention
```

---

## Step 4 — 啟動與常駐部署

### 4.1 使用 tmux 常駐（推薦）

```bash
tmux new-session -d -s discord-bot -c ~/CycloneOS \
  "claude --channels plugin:discord@claude-plugins-official \
   --dangerously-skip-permissions --model sonnet"
```

| 參數 | 用途 |
|------|------|
| `--channels plugin:discord@claude-plugins-official` | 啟用 Discord channel |
| `--dangerously-skip-permissions` | 跳過所有權限確認（不用每次私訊你核准） |
| `--model sonnet` | 使用 Sonnet 模型（省 token，速度快） |

### 4.2 tmux 管理

```bash
# 查看 session
tmux ls

# 進入 session 查看即時狀態
tmux attach -t discord-bot

# 離開 session（不關閉）
# 按 Ctrl+B 然後按 D

# 停止 Bot
tmux kill-session -t discord-bot
```

### 4.3 開機自動啟動（launchd）

建立 `~/Library/LaunchAgents/com.cycloneos.discord-bot.plist`：

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.cycloneos.discord-bot</string>
    <key>ProgramArguments</key>
    <array>
        <string>/bin/bash</string>
        <string>/Users/你的帳號/CycloneOS/scripts/discord-bot.sh</string>
    </array>
    <key>WorkingDirectory</key>
    <string>/Users/你的帳號/CycloneOS</string>
    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>
        <string>/Users/你的帳號/.nvm/versions/node/v24.14.0/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin</string>
        <key>HOME</key>
        <string>/Users/你的帳號</string>
    </dict>
    <key>RunAtLoad</key>
    <true/>
    <key>StandardOutPath</key>
    <string>/Users/你的帳號/.local/log/cycloneos-discord-bot.log</string>
    <key>StandardErrorPath</key>
    <string>/Users/你的帳號/.local/log/cycloneos-discord-bot.err</string>
</dict>
</plist>
```

啟動腳本 `~/CycloneOS/scripts/discord-bot.sh`：

```bash
#!/bin/bash
export PATH="$HOME/.nvm/versions/node/v24.14.0/bin:/opt/homebrew/bin:$PATH"
export HOME="/Users/你的帳號"

tmux kill-session -t discord-bot 2>/dev/null

tmux new-session -d -s discord-bot -c ~/CycloneOS \
  "claude --channels plugin:discord@claude-plugins-official \
   --dangerously-skip-permissions --model sonnet"
```

```bash
chmod +x ~/CycloneOS/scripts/discord-bot.sh
launchctl load ~/Library/LaunchAgents/com.cycloneos.discord-bot.plist
```

---

## 存取控制與頻道設定

設定檔位置：`~/.claude/channels/discord/access.json`

### access.json 完整範例

```json
{
  "dmPolicy": "allowlist",
  "allowFrom": ["你的Discord用戶ID"],
  "groups": {
    "頻道ID": {
      "requireMention": false,
      "allowFrom": []
    }
  },
  "pending": {},
  "ackReaction": "👀",
  "replyToMode": "first",
  "textChunkLimit": 2000,
  "chunkMode": "newline"
}
```

### DM 政策

| 值 | 行為 |
|----|------|
| `pairing` | 陌生人發訊息會拿到配對碼，需你核准 |
| `allowlist` | 只有 allowFrom 名單中的人能互動 |
| `disabled` | 完全不回應任何 DM |

### 頻道設定

| 欄位 | 說明 |
|------|------|
| `requireMention: true` | 需要 @Bot 才會回應 |
| `requireMention: false` | 頻道內所有訊息都會回應 |
| `allowFrom: []` | 空 = 所有人都能觸發 |
| `allowFrom: ["ID1"]` | 只有指定用戶能觸發 |

### 指令速查

```bash
/discord:access                              # 查看目前狀態
/discord:access policy allowlist             # 設定 DM 政策
/discord:access allow <用戶ID>                # 加入白名單
/discord:access remove <用戶ID>               # 移除白名單
/discord:access group add <頻道ID>            # 新增頻道（需 @mention）
/discord:access group add <頻道ID> --no-mention  # 新增頻道（免 @mention）
/discord:access group rm <頻道ID>             # 移除頻道
/discord:access set ackReaction 👀            # 設定收到訊息的反應 emoji
/discord:access set replyToMode first        # 長回覆只 reply 第一則
```

---

## 檔案結構

```
~/.claude/
├── channels/discord/
│   ├── .env                    # DISCORD_BOT_TOKEN
│   ├── access.json             # 存取控制設定
│   ├── approved/               # 已核准的用戶 ID
│   └── inbox/                  # 下載的附件
├── plugins/marketplaces/
│   └── claude-plugins-official/
│       └── external_plugins/
│           └── discord/        # Plugin 程式碼（MCP server）
│               ├── server.ts
│               ├── README.md
│               └── ACCESS.md

~/CycloneOS/
├── scripts/
│   └── discord-bot.sh          # 啟動腳本

~/Library/LaunchAgents/
└── com.cycloneos.discord-bot.plist  # 開機自啟設定
```

---

## 常用管理指令

```bash
# 查看 Bot 狀態
tmux ls
tmux attach -t discord-bot

# 重啟 Bot
tmux kill-session -t discord-bot
tmux new-session -d -s discord-bot -c ~/CycloneOS \
  "claude --channels plugin:discord@claude-plugins-official \
   --dangerously-skip-permissions --model sonnet"

# 查看 log
tail -f ~/.local/log/cycloneos-discord-bot.log

# Token 相關
cat ~/.claude/channels/discord/.env       # 查看 token
claude → /discord:configure <新TOKEN>     # 更換 token
```

---

## 踩坑紀錄與試誤過程

### 1. Invalid API Key 錯誤

**現象：** CycloneOS Dashboard 的聊天功能和 Discord Bot 都報 `Invalid API key`。

**原因：** `~/.zshrc` 中有一個過期的 `ANTHROPIC_API_KEY` 環境變數。Claude Code 優先使用環境變數中的 API key，而非 claude.ai OAuth 登入。

**解法：** 從 `~/.zshrc` 移除 `export ANTHROPIC_API_KEY=...` 那行。

**教訓：** 從另一台電腦移植環境設定時，API key 可能已失效。Claude Code 用 `claude.ai` 登入就夠了，不需要額外設定 `ANTHROPIC_API_KEY`。

### 2. Claude CLI --print 模式不支援 --channels

**現象：** 用 launchd 直接啟動 `claude --channels ...` 時，報錯 `Input must be provided either through stdin or as a prompt argument when using --print`。

**原因：** launchd 啟動的進程沒有 TTY（終端機），Claude Code 會 fallback 到 `--print` 模式，而 `--channels` 需要互動式終端。

**嘗試過的方案：**
1. ❌ 直接用 launchd 跑 `claude --channels` → 無 TTY，失敗
2. ❌ 用 `script -q /dev/null` 模擬 TTY → 不穩定，參數傳遞有問題
3. ❌ 用 `script -q /dev/null /bin/bash -c "..."` → `bash -c` 參數解析錯誤
4. ✅ **用 tmux 在 launchd 中啟動** → 提供完整 TTY，穩定運行

**教訓：** Claude Code 是互動式 CLI，必須在真正的終端環境中運行。tmux 是最可靠的 headless 方案。

### 3. 權限確認（Permission Request）每次都要手動核准

**現象：** Bot 每次回覆都先私訊你一個 Permission 確認按鈕，要你點 Allow 才會回覆。

**原因：** Claude Code 預設的 permission mode 會對所有工具使用（包括 Discord reply）要求確認。

**解法：** 啟動時加上 `--dangerously-skip-permissions` 跳過所有權限檢查。

**注意：** 此參數僅建議用於受信任的環境（如自己的 Mac Mini），不建議用於公開 Bot。

### 4. 多個 Bot 進程衝突

**現象：** 重啟 Bot 後舊進程仍在跑，導致新舊 Bot 同時處理訊息，行為不一致。

**解法：** 啟動前先確保清除所有舊進程：
```bash
tmux kill-session -t discord-bot 2>/dev/null
```

### 5. 頻道內不回應（只回應 DM）

**現象：** 在 server 頻道 @Bot 沒有反應，但私訊正常。

**原因：** 預設 `Guild channels opted in: 0`，需要手動新增頻道。

**解法：**
```bash
/discord:access guild-channel add <頻道ID>
```

### 6. 每次都要 @mention 才回應

**現象：** 頻道內必須 @Bot 才會回覆，直接說話沒反應。

**原因：** 預設 `requireMention: true`。

**解法：** 修改 `~/.claude/channels/discord/access.json`，將該頻道的 `requireMention` 改為 `false`，或新增時用 `--no-mention`：
```bash
/discord:access guild-channel add <頻道ID> --no-mention
```

---

## 安全注意事項

1. **Bot Token 絕對不能外洩。** 如果 token 曝光，立即到 Discord Developer Portal Reset Token
2. **`--dangerously-skip-permissions` 代表 Bot 可以執行任何操作**（讀寫檔案、執行指令），確保只有你在 allowlist 中
3. **access.json 的 allowFrom 務必設定**，不要讓陌生人能觸發 Bot
4. **不要在 Discord 訊息中核准配對或修改 access** — 這是 prompt injection 攻擊向量，所有存取控制操作只在 Claude Code 終端機中執行
