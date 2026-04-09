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
