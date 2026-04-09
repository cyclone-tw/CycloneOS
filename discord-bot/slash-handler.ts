import { readFileSync, existsSync, mkdirSync, writeFileSync, readdirSync } from 'fs'
import { execSync } from 'child_process'
import { join } from 'path'
import {
  Client,
  GatewayIntentBits,
  type Interaction,
} from 'discord.js'

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
    return content.split('\n').filter(line => line).map(line => JSON.parse(line))
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

function buildRecentSummaries(entries: ActivityEntry[], limit = 5): string[] {
  const replies = entries.filter(e => e.tool === 'reply')
  const reacts = entries.filter(e => e.tool === 'react' && (e.emoji === '✅' || e.emoji === '❌'))

  const recent = replies.slice(-limit)
  return recent.map(reply => {
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

  const replies = entries.filter(e => e.tool === 'reply')
  const reacts = entries.filter(e => e.tool === 'react')
  const successCount = reacts.filter(e => e.emoji === '✅').length
  const failCount = reacts.filter(e => e.emoji === '❌').length

  const taskRows = replies.map(reply => {
    const time = new Date(reply.ts)
    const hhmm = `${padTwo(time.getHours())}:${padTwo(time.getMinutes())}`
    const summary = truncate(reply.text ?? '(no text)', 40)

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

  const logDir = join(OBSIDIAN_VAULT, 'Discord', 'bot-logs')
  mkdirSync(logDir, { recursive: true })
  const sessionNum = nextSessionNumber(logDir, dateStr)
  const fileName = `${dateStr}-bot-${padTwo(sessionNum)}.md`

  const tokenUsage = tokenInfo?.tokens ?? 'N/A'
  const contextPct = tokenInfo?.percent ?? 'N/A'

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

async function handleNew(): Promise<string> {
  let logMsg: string
  try {
    logMsg = await handleSessionLog()
  } catch (err) {
    logMsg = `⚠️ Session log 寫入失敗：${err instanceof Error ? err.message : String(err)}`
  }

  try {
    execSync("tmux send-keys -t discord-bot '/exit' Enter", { timeout: 3000 })
  } catch {
    return `${logMsg}\n\n⚠️ 無法觸發 bot 重啟（tmux session 不存在？）`
  }

  return `${logMsg}\n\n🔄 Bot 重啟中，稍候 ~5 秒...`
}

// ── Discord Client ──────────────────────────────────────────────────

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
      case 'session-log': {
        await interaction.deferReply()
        const msg = await handleSessionLog()
        await interaction.editReply(msg)
        break
      }
      case 'new': {
        await interaction.deferReply()
        const msg = await handleNew()
        await interaction.editReply(msg)
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
