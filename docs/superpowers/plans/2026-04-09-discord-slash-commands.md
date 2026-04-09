# Discord Slash Commands Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Discord slash commands (/context, /session-log, /new) via an independent companion script with hook-based state tracking.

**Architecture:** Companion Bun script handles slash command interactions directly (no LLM). Claude Code hooks automatically log bot reply/react activity to a shared JSONL file. The handler reads this file + tmux status to build responses.

**Tech Stack:** Bun, discord.js 14, Claude Code PostToolUse hooks, jq, tmux

**Spec:** `docs/superpowers/specs/2026-04-09-discord-slash-commands-design.md`

---

## File Structure

```
discord-bot/
├── CLAUDE.md              # Modify: add slash commands section
├── package.json           # Create: discord.js dependency
├── tsconfig.json          # Create: Bun TS config
├── slash-handler.ts       # Create: main handler (Discord client + commands)
├── settings.json          # Create: Claude Code hook config
└── hooks/
    └── log-activity.sh    # Create: PostToolUse hook script

scripts/
└── discord-bot.sh         # Modify: add handler startup + state management
```

---

### Task 1: Hook Infrastructure

**Files:**
- Create: `discord-bot/hooks/log-activity.sh`
- Create: `discord-bot/settings.json`

- [ ] **Step 1: Create the hook script**

```bash
# discord-bot/hooks/log-activity.sh
#!/bin/bash
# PostToolUse hook: logs Discord reply/react activity to JSONL
# Receives hook payload on stdin with tool_name, tool_input, tool_response

LOG_FILE="${BOT_DIR:-$HOME/discord-bot}/.bot-activity.jsonl"
INPUT=$(cat)

TOOL=$(echo "$INPUT" | jq -r '.tool_name // empty' | sed 's/.*__//')
TS=$(date +"%Y-%m-%dT%H:%M:%S%z")
CHAT_ID=$(echo "$INPUT" | jq -r '.tool_input.chat_id // empty')
TEXT=$(echo "$INPUT" | jq -r '.tool_input.text // empty')
MSG_ID=$(echo "$INPUT" | jq -r '.tool_input.message_id // empty')
EMOJI=$(echo "$INPUT" | jq -r '.tool_input.emoji // empty')

# reply tool_response format: {content: [{type:"text", text:"sent (id: 123456)"}]}
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

- [ ] **Step 2: Create the hook settings**

```json
// discord-bot/settings.json
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

- [ ] **Step 3: Test hook script with mock data**

Create a test payload and pipe it to the script:

```bash
echo '{"tool_name":"mcp__plugin_discord_discord__reply","tool_input":{"chat_id":"123","text":"測試回覆"},"tool_response":{"content":[{"type":"text","text":"sent (id: 999888)"}]}}' | BOT_DIR=/tmp/hook-test bash discord-bot/hooks/log-activity.sh
cat /tmp/hook-test/.bot-activity.jsonl
```

Expected output: one JSON line with `tool:"reply"`, `chat_id:"123"`, `text:"測試回覆"`, `message_id:"999888"`.

Test react:

```bash
echo '{"tool_name":"mcp__plugin_discord_discord__react","tool_input":{"chat_id":"123","message_id":"456","emoji":"✅"}}' | BOT_DIR=/tmp/hook-test bash discord-bot/hooks/log-activity.sh
cat /tmp/hook-test/.bot-activity.jsonl
```

Expected: second line with `tool:"react"`, `emoji:"✅"`.

- [ ] **Step 4: Clean up test files and commit**

```bash
rm -rf /tmp/hook-test
git add discord-bot/hooks/log-activity.sh discord-bot/settings.json
git commit -m "feat(discord): add PostToolUse hook for activity logging"
```

---

### Task 2: Slash Handler — Project Setup + Shared Utilities

**Files:**
- Create: `discord-bot/package.json`
- Create: `discord-bot/tsconfig.json`
- Create: `discord-bot/slash-handler.ts` (scaffolding + utility functions only)

- [ ] **Step 1: Create package.json**

```json
// discord-bot/package.json
{
  "name": "cycloneos-discord-slash-handler",
  "private": true,
  "type": "module",
  "dependencies": {
    "discord.js": "^14.14.0"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
// discord-bot/tsconfig.json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "types": ["bun-types"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  }
}
```

- [ ] **Step 3: Install dependencies**

```bash
cd discord-bot && bun install
```

Add `discord-bot/node_modules` and `discord-bot/bun.lock` to `.gitignore` if not already covered.

- [ ] **Step 4: Create slash-handler.ts with utility functions**

This step creates the file with all shared utilities (state reading, formatting, tmux parsing). No Discord client yet — just pure functions that will be used by the command handlers.

```typescript
// discord-bot/slash-handler.ts
import { readFileSync, existsSync, mkdirSync, writeFileSync, readdirSync } from 'fs'
import { execSync } from 'child_process'
import { join } from 'path'

// ── Config ──────────────────────────────────────────────────────────
const BOT_DIR = process.env.BOT_DIR ?? join(process.env.HOME!, 'discord-bot')
const OBSIDIAN_VAULT = process.env.OBSIDIAN_VAULT ?? ''
const STARTUP_FILE = join(BOT_DIR, '.bot-startup.json')
const ACTIVITY_FILE = join(BOT_DIR, '.bot-activity.jsonl')

// ── Types ───────────────────────────────────────────────────────────
interface StartupState {
  startedAt: string
  version: string
}

interface ActivityEntry {
  ts: string
  tool: string
  chat_id: string
  text?: string
  message_id?: string
  emoji?: string
}

interface TokenInfo {
  tokens: string   // e.g. "45K"
  percent: string  // e.g. "23%"
}

// ── State Readers ───────────────────────────────────────────────────

function readStartup(): StartupState | null {
  try {
    return JSON.parse(readFileSync(STARTUP_FILE, 'utf8'))
  } catch {
    return null
  }
}

function readActivity(): ActivityEntry[] {
  try {
    const content = readFileSync(ACTIVITY_FILE, 'utf8').trim()
    if (!content) return []
    return content.split('\n').map(line => JSON.parse(line))
  } catch {
    return []
  }
}

function readTmuxTokens(): TokenInfo | null {
  try {
    const pane = execSync('tmux capture-pane -t discord-bot -p', {
      encoding: 'utf8',
      timeout: 3000,
    })
    const tokMatch = pane.match(/(\d+(?:\.\d+)?[KM])\s*tok/)
    const pctMatch = pane.match(/(\d+)%\s*(?:ctx|context)/)
    if (tokMatch && pctMatch) {
      return { tokens: tokMatch[1], percent: pctMatch[1] + '%' }
    }
    return null
  } catch {
    return null
  }
}

// ── Formatting Helpers ──────────────────────────────────────────────

function formatUptime(startedAt: string): string {
  const ms = Date.now() - new Date(startedAt).getTime()
  const totalMin = Math.floor(ms / 60000)
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text
  return text.slice(0, maxLen) + '...'
}

/**
 * Build recent task summaries from activity entries.
 * Pairs each reply with a subsequent react (✅/❌) within the same chat_id
 * if the react occurs within 10 seconds of the reply.
 */
function buildRecentSummaries(entries: ActivityEntry[], limit = 5): string[] {
  const replies = entries.filter(e => e.tool === 'reply')
  const reacts = entries.filter(e => e.tool === 'react' && (e.emoji === '✅' || e.emoji === '❌'))

  const recent = replies.slice(-limit)
  return recent.map(reply => {
    // Find matching react: same chat_id, within 10s after reply
    const replyTime = new Date(reply.ts).getTime()
    const matchReact = reacts.find(r => {
      const reactTime = new Date(r.ts).getTime()
      return r.chat_id === reply.chat_id &&
        reactTime >= replyTime &&
        reactTime - replyTime < 10000
    })
    const icon = matchReact?.emoji ?? '⏳'
    const summary = truncate(reply.text ?? '(no text)', 30)
    return `  ${icon} ${summary}`
  })
}

function nextSessionNumber(dir: string, datePrefix: string): number {
  try {
    const files = readdirSync(dir)
    const existing = files
      .filter(f => f.startsWith(datePrefix + '-bot-'))
      .map(f => {
        const m = f.match(/-bot-(\d+)\.md$/)
        return m ? parseInt(m[1], 10) : 0
      })
    return existing.length > 0 ? Math.max(...existing) + 1 : 1
  } catch {
    return 1
  }
}

function padTwo(n: number): string {
  return n.toString().padStart(2, '0')
}
```

- [ ] **Step 5: Verify it compiles**

```bash
cd discord-bot && bun build slash-handler.ts --outdir /tmp/test-build --target bun
```

Expected: builds without error (the file has no entry point yet, but types should check).

- [ ] **Step 6: Commit**

```bash
git add discord-bot/package.json discord-bot/tsconfig.json discord-bot/slash-handler.ts
# Don't add node_modules or bun.lock to git (should be in .gitignore)
git commit -m "feat(discord): scaffold slash handler with state utilities"
```

---

### Task 3: Slash Handler — /context Command

**Files:**
- Modify: `discord-bot/slash-handler.ts`

- [ ] **Step 1: Add the /context handler function**

Append after the utility functions:

```typescript
// ── Command Handlers ────────────────────────────────────────────────

function handleContext(): string {
  const startup = readStartup()
  const entries = readActivity()
  const tokenInfo = readTmuxTokens()

  const uptime = startup ? formatUptime(startup.startedAt) : '未知'
  const replyCount = entries.filter(e => e.tool === 'reply').length
  const summaries = buildRecentSummaries(entries)
  const tokenLine = tokenInfo
    ? `${tokenInfo.tokens} tok / ${tokenInfo.percent} used`
    : 'N/A'

  let msg = `🤖 **Bot Session 狀態**\n─────────────────\n`
  msg += `⏱ 運行時間：${uptime}\n`
  msg += `📨 已處理訊息：${replyCount} 則\n`

  if (summaries.length > 0) {
    msg += `📋 最近處理：\n${summaries.join('\n')}\n`
  }

  msg += `🧠 Context：${tokenLine}`
  return msg
}
```

- [ ] **Step 2: Add Discord client and interaction routing**

Append at the bottom of the file:

```typescript
// ── Discord Client ──────────────────────────────────────────────────
import {
  Client,
  GatewayIntentBits,
  type Interaction,
} from 'discord.js'

const TOKEN = process.env.DISCORD_BOT_TOKEN
if (!TOKEN) {
  console.error('DISCORD_BOT_TOKEN required')
  process.exit(1)
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
})

client.on('interactionCreate', async (interaction: Interaction) => {
  if (!interaction.isChatInputCommand()) return

  try {
    switch (interaction.commandName) {
      case 'context': {
        const msg = handleContext()
        await interaction.reply(msg)
        break
      }
      default:
        await interaction.reply({ content: `未知指令：/${interaction.commandName}`, ephemeral: true })
    }
  } catch (err) {
    console.error(`slash command error (${interaction.commandName}):`, err)
    const errorMsg = `❌ 指令執行失敗：${err instanceof Error ? err.message : String(err)}`
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ content: errorMsg, ephemeral: true }).catch(() => {})
    } else {
      await interaction.reply({ content: errorMsg, ephemeral: true }).catch(() => {})
    }
  }
})

client.once('ready', c => {
  console.log(`Slash handler connected as ${c.user.tag}`)
})

client.login(TOKEN)
```

- [ ] **Step 3: Test locally**

Start the handler manually:

```bash
cd discord-bot && DISCORD_BOT_TOKEN=$(grep DISCORD_BOT_TOKEN ~/.claude/channels/discord/.env | cut -d= -f2-) bun run slash-handler.ts
```

Expected: `Slash handler connected as CycloneOS#...`

Create mock state files and test /context:

```bash
echo '{"startedAt":"2026-04-09T11:00:00+0800","version":"2.1.97"}' > ~/discord-bot/.bot-startup.json
echo '{"ts":"2026-04-09T11:10:00+0800","tool":"reply","chat_id":"123","text":"測試回覆一"}' > ~/discord-bot/.bot-activity.jsonl
echo '{"ts":"2026-04-09T11:10:02+0800","tool":"react","chat_id":"123","message_id":"456","emoji":"✅"}' >> ~/discord-bot/.bot-activity.jsonl
```

Go to Discord, type `/context`, select the CycloneOS bot command. Should see formatted status.

Ctrl+C to stop handler.

- [ ] **Step 4: Commit**

```bash
git add discord-bot/slash-handler.ts
git commit -m "feat(discord): implement /context slash command"
```

---

### Task 4: Slash Handler — /session-log Command

**Files:**
- Modify: `discord-bot/slash-handler.ts`

- [ ] **Step 1: Add the session-log handler function**

Insert after `handleContext()`:

```typescript
async function handleSessionLog(): Promise<string> {
  if (!OBSIDIAN_VAULT) {
    throw new Error('OBSIDIAN_VAULT 環境變數未設定')
  }

  const startup = readStartup()
  const entries = readActivity()
  const tokenInfo = readTmuxTokens()

  const now = new Date()
  const dateStr = `${now.getFullYear()}-${padTwo(now.getMonth() + 1)}-${padTwo(now.getDate())}`
  const uptime = startup ? formatUptime(startup.startedAt) : '未知'

  // Count replies and results
  const replies = entries.filter(e => e.tool === 'reply')
  const reacts = entries.filter(e => e.tool === 'react')
  const successCount = reacts.filter(e => e.emoji === '✅').length
  const failCount = reacts.filter(e => e.emoji === '❌').length

  // Build task log table rows
  const taskRows = replies.map(reply => {
    const time = new Date(reply.ts)
    const hhmm = `${padTwo(time.getHours())}:${padTwo(time.getMinutes())}`
    const summary = truncate(reply.text ?? '(no text)', 40)

    // Find matching react
    const replyTime = time.getTime()
    const matchReact = reacts.find(r => {
      const reactTime = new Date(r.ts).getTime()
      return r.chat_id === reply.chat_id &&
        reactTime >= replyTime &&
        reactTime - replyTime < 10000
    })
    const result = matchReact?.emoji ?? '⏳'

    return `| ${hhmm} | ${summary} | ${result} |`
  })

  // Determine session number
  const logDir = join(OBSIDIAN_VAULT, 'Discord', 'bot-logs')
  mkdirSync(logDir, { recursive: true })
  const sessionNum = nextSessionNumber(logDir, dateStr)
  const fileName = `${dateStr}-bot-${padTwo(sessionNum)}.md`

  // Token info for frontmatter
  const tokenUsage = tokenInfo?.tokens ?? 'N/A'
  const contextPct = tokenInfo?.percent ?? 'N/A'

  // Assemble markdown
  const md = `---
type: bot-log
date: ${dateStr}
session: ${sessionNum}
duration: ${uptime}
message-count: ${replies.length}
token-usage: ${tokenUsage}
context-pct: ${contextPct}
---

# Bot Log ${dateStr} #${sessionNum}

## 處理紀錄

| 時間 | 摘要 | 結果 |
|------|------|------|
${taskRows.length > 0 ? taskRows.join('\n') : '| - | 無活動記錄 | - |'}

## 統計
- 運行時間：${uptime}
- 處理訊息：${replies.length} 則（✅ ${successCount} / ❌ ${failCount}）
- Token 用量：${tokenUsage} / ${contextPct} context
`

  writeFileSync(join(logDir, fileName), md)
  return `✅ Bot log 已儲存：${fileName}`
}
```

- [ ] **Step 2: Wire into interaction router**

In the `switch (interaction.commandName)` block, add after the `context` case:

```typescript
      case 'session-log': {
        await interaction.deferReply()
        const msg = await handleSessionLog()
        await interaction.editReply(msg)
        break
      }
```

- [ ] **Step 3: Test with mock data**

Start handler, ensure mock state files exist (from Task 3 Step 3), then:
1. Set `OBSIDIAN_VAULT` to a temp dir for testing
2. Type `/session-log` in Discord
3. Check that the file was created with correct format

```bash
cd discord-bot && \
  DISCORD_BOT_TOKEN=$(grep DISCORD_BOT_TOKEN ~/.claude/channels/discord/.env | cut -d= -f2-) \
  OBSIDIAN_VAULT=/tmp/test-vault \
  bun run slash-handler.ts
```

After invoking `/session-log` in Discord:

```bash
cat /tmp/test-vault/Discord/bot-logs/2026-04-09-bot-01.md
```

Expected: properly formatted bot log with frontmatter, table, and statistics.

Ctrl+C to stop handler.

- [ ] **Step 4: Commit**

```bash
git add discord-bot/slash-handler.ts
git commit -m "feat(discord): implement /session-log slash command"
```

---

### Task 5: Slash Handler — /new Command

**Files:**
- Modify: `discord-bot/slash-handler.ts`

- [ ] **Step 1: Add the /new handler function**

Insert after `handleSessionLog()`:

```typescript
async function handleNew(): Promise<string> {
  // Step 1: Write session log
  let logMsg: string
  try {
    logMsg = await handleSessionLog()
  } catch (err) {
    logMsg = `⚠️ Session log 寫入失敗：${err instanceof Error ? err.message : String(err)}`
  }

  // Step 2: Trigger bot restart via tmux
  try {
    execSync("tmux send-keys -t discord-bot '/exit' Enter", { timeout: 3000 })
  } catch {
    return `${logMsg}\n\n⚠️ 無法觸發 bot 重啟（tmux session 不存在？）`
  }

  return `${logMsg}\n\n🔄 Bot 重啟中，稍候 ~5 秒...`
}
```

- [ ] **Step 2: Wire into interaction router**

In the `switch (interaction.commandName)` block, add after the `session-log` case:

```typescript
      case 'new': {
        await interaction.deferReply()
        const msg = await handleNew()
        await interaction.editReply(msg)
        break
      }
```

- [ ] **Step 3: Commit**

```bash
git add discord-bot/slash-handler.ts
git commit -m "feat(discord): implement /new slash command with restart"
```

---

### Task 6: Update Startup Script

**Files:**
- Modify: `scripts/discord-bot.sh`

- [ ] **Step 1: Rewrite discord-bot.sh**

Replace the entire file:

```bash
#!/bin/bash
export PATH="$HOME/.nvm/versions/node/v24.14.0/bin:/opt/homebrew/bin:$PATH"

BOT_DIR="$HOME/discord-bot"
REPO_DIR="$HOME/CycloneOS"
HANDLER_DIR="$REPO_DIR/discord-bot"

# ── Environment ──────────────────────────────────────────────────────
export DISCORD_BOT_TOKEN=$(grep DISCORD_BOT_TOKEN "$HOME/.claude/channels/discord/.env" | cut -d= -f2-)
export OBSIDIAN_VAULT=$(find "$HOME/Library/CloudStorage" -maxdepth 3 -name "Obsidian-Cyclone" -type d 2>/dev/null | head -1)
export BOT_DIR

# ── Prepare bot working directory ────────────────────────────────────
mkdir -p "$BOT_DIR/.claude" "$BOT_DIR/hooks"
cp "$REPO_DIR/discord-bot/CLAUDE.md" "$BOT_DIR/CLAUDE.md"
cp "$REPO_DIR/discord-bot/settings.json" "$BOT_DIR/.claude/settings.json"
cp "$REPO_DIR/discord-bot/hooks/log-activity.sh" "$BOT_DIR/hooks/"
chmod +x "$BOT_DIR/hooks/log-activity.sh"

# Init git repo if needed (Claude Code needs git for project settings)
if [ ! -d "$BOT_DIR/.git" ]; then
  git -C "$BOT_DIR" init -q
fi

# ── Install slash handler dependencies ───────────────────────────────
cd "$HANDLER_DIR" && bun install --frozen-lockfile 2>/dev/null || bun install
cd "$REPO_DIR"

# ── Kill old sessions ────────────────────────────────────────────────
tmux kill-session -t discord-bot 2>/dev/null
tmux kill-session -t slash-handler 2>/dev/null

# ── Start slash handler ──────────────────────────────────────────────
tmux new-session -d -s slash-handler -c "$HANDLER_DIR" \
  "DISCORD_BOT_TOKEN=$DISCORD_BOT_TOKEN OBSIDIAN_VAULT=$OBSIDIAN_VAULT BOT_DIR=$BOT_DIR bun run slash-handler.ts; echo 'Slash handler exited, press Enter to restart'; read"

# ── Start bot (while-loop auto-restart) ──────────────────────────────
tmux new-session -d -s discord-bot -c "$BOT_DIR" "
while true; do
  echo \"[\$(date)] Starting Discord bot...\"
  # Write startup state
  CLAUDE_VER=\$(claude --version 2>/dev/null | head -1 || echo 'unknown')
  printf '{\"startedAt\":\"%s\",\"version\":\"%s\"}\n' \"\$(date +%Y-%m-%dT%H:%M:%S%z)\" \"\$CLAUDE_VER\" > \"$BOT_DIR/.bot-startup.json\"
  # Clear activity log for fresh session
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

- [ ] **Step 2: Commit**

```bash
git add scripts/discord-bot.sh
git commit -m "feat(discord): update startup script for slash handler + hooks"
```

---

### Task 7: Update CLAUDE.md + Gitignore

**Files:**
- Modify: `discord-bot/CLAUDE.md`
- Modify: `.gitignore`

- [ ] **Step 1: Add slash commands section to CLAUDE.md**

Append to the end of `discord-bot/CLAUDE.md`:

```markdown

## Slash Commands（外部處理）

`/context`、`/session-log`、`/new` 由獨立的 slash handler 處理，不會進入此 session。
如果使用者在一般訊息中提到這些指令（非 slash command），可以告知他們使用 Discord 的 `/` 選單。
```

- [ ] **Step 2: Update .gitignore**

Ensure these entries exist in the root `.gitignore`:

```
discord-bot/node_modules/
discord-bot/bun.lock
```

- [ ] **Step 3: Commit**

```bash
git add discord-bot/CLAUDE.md .gitignore
git commit -m "docs(discord): add slash command section to bot CLAUDE.md"
```

---

### Task 8: Integration Test

**Files:** None (manual testing)

- [ ] **Step 1: Deploy everything**

```bash
cd ~/CycloneOS && bash scripts/discord-bot.sh
```

Verify both tmux sessions are running:

```bash
tmux ls
```

Expected: `discord-bot` and `slash-handler` both listed.

- [ ] **Step 2: Verify slash handler connected**

```bash
tmux capture-pane -t slash-handler -p | tail -5
```

Expected: `Slash handler connected as CycloneOS#...`

- [ ] **Step 3: Verify bot started**

Wait for trust prompt, then:

```bash
sleep 8 && tmux send-keys -t discord-bot Enter
sleep 8 && tmux capture-pane -t discord-bot -p | tail -5
```

Expected: `Listening for channel messages from: plugin:discord@claude-plugins-official`

- [ ] **Step 4: Test hook — send message to bot via Discord**

Send a regular message to the bot in Discord (e.g. tag @CycloneOS with a simple question). Wait for bot to reply. Then check:

```bash
cat ~/discord-bot/.bot-activity.jsonl
```

Expected: at least one `reply` entry and one `react` entry (👀 ack + ✅/❌ result).

- [ ] **Step 5: Test /context**

In Discord, type `/context` and select the CycloneOS bot command.

Expected response includes:
- ⏱ 運行時間（matches actual uptime）
- 📨 已處理訊息：at least 1
- 📋 最近處理：the message you just sent
- 🧠 Context：token data from tmux

- [ ] **Step 6: Test /session-log**

In Discord, type `/session-log`.

Expected: `✅ Bot log 已儲存：2026-04-09-bot-01.md`

Verify the file:

```bash
VAULT=$(find ~/Library/CloudStorage -maxdepth 3 -name "Obsidian-Cyclone" -type d | head -1)
cat "$VAULT/Discord/bot-logs/2026-04-09-bot-01.md"
```

Expected: properly formatted markdown with frontmatter, task table, statistics.

- [ ] **Step 7: Test /new**

In Discord, type `/new`.

Expected:
1. Response includes session log confirmation + `🔄 Bot 重啟中，稍候 ~5 秒...`
2. Bot restarts (check tmux `discord-bot` session shows restart message)
3. After restart, `~/discord-bot/.bot-activity.jsonl` is empty

- [ ] **Step 8: Test /context after restart**

In Discord, type `/context`.

Expected: fresh session — 0 messages, short uptime, no recent tasks.

- [ ] **Step 9: Final commit if any fixes were needed**

```bash
git add -A && git commit -m "fix(discord): integration test fixes"
```

Only if changes were made during testing. Skip if everything passed clean.
