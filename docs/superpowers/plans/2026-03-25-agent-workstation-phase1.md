# Agent Workstation Phase 1 — Foundation Infrastructure

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the server-side agent infrastructure (AgentManager, ProcessPool, EventBus, SessionStore, API routes) and connect existing prototype UI to real dispatch/streaming.

**Architecture:** CLI spawn via `claude -p` with agent-specific flags → AgentManager coordinates lifecycle → SSE streams events to frontend → Zustand agent-store manages per-tab state. Existing `/api/chat` route preserved for backward compatibility. Dispatch + SSE combined in single endpoint (like existing `/api/chat`) to avoid race conditions.

**Tech Stack:** Next.js 16 (App Router), TypeScript, Zustand 5, better-sqlite3, Claude CLI (`--print --output-format stream-json --verbose`), SSE streaming

**Spec:** `docs/superpowers/specs/2026-03-25-agent-workstation-design.md`

---

## File Structure

```
dashboard/src/
├── lib/
│   ├── agents/
│   │   ├── types.ts              ← NEW: AgentDefinition, AgentProcess, SpawnOptions interfaces
│   │   └── definitions.ts        ← NEW: 6 agent definitions (data only, no UI)
│   ├── agent-manager.ts          ← NEW: AgentManager singleton (ProcessPool + EventBus + dispatch)
│   ├── executors/
│   │   ├── executor.ts           ← NEW: Executor interface
│   │   └── local-executor.ts     ← NEW: CLI spawn implementation
│   ├── event-bus.ts              ← NEW: EventEmitter wrapper for tool/text/session events
│   ├── session-store.ts          ← NEW: SQLite CRUD (sessions, messages, activities)
│   └── claude-bridge.ts          ← MODIFY: add appendSystemPrompt option
├── stores/
│   ├── chat-store.ts             ← KEEP: no changes (used until Phase 3)
│   └── agent-store.ts            ← NEW: Zustand store for multi-tab agent state
├── components/chat/
│   ├── agent-tabs.tsx            ← MODIFY: connect to agent-store instead of local state
│   ├── activity-feed.tsx         ← MODIFY: connect to agent-store instead of mock data
│   ├── chat-panel.tsx            ← MODIFY: dispatch via agent API when agent tab active
│   └── message-list.tsx          ← MODIFY: accept messages + isStreaming props
├── app/api/
│   ├── agents/
│   │   ├── dispatch/route.ts     ← NEW: POST — dispatch agent + SSE stream (combined)
│   │   ├── stop/route.ts         ← NEW: POST — kill agent process
│   │   └── sessions/route.ts     ← NEW: GET — list session history
│   └── chat/route.ts             ← KEEP: no changes
└── types/
    └── chat.ts                   ← MODIFY: add ClaudeModel + agent-related types
```

**Design decisions (from review):**
- Dispatch + stream combined in single POST endpoint (eliminates race condition, matches existing `/api/chat` pattern)
- All singletons use `globalThis` pattern to survive Next.js HMR
- `ClaudeModel` defined once in `types/chat.ts` (no duplication)
- `allowedTools` deferred to Phase 2 (noted in types as optional)
- `maxTurns` removed (no CLI flag support)

**Config changes:**
- `dashboard/next.config.ts` — add `serverExternalPackages: ['better-sqlite3']`
- `dashboard/package.json` — add `better-sqlite3`, `@types/better-sqlite3`
- `dashboard/.gitignore` — add `.data/`

---

## Task 1: Dependencies & Config

**Files:**
- Modify: `dashboard/package.json`
- Modify: `dashboard/next.config.ts`
- Modify: `dashboard/.gitignore`

- [ ] **Step 1: Install better-sqlite3**

```bash
cd dashboard && npm install better-sqlite3 && npm install -D @types/better-sqlite3
```

- [ ] **Step 2: Configure Next.js to externalize better-sqlite3**

In `dashboard/next.config.ts`:
```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3"],
};

export default nextConfig;
```

- [ ] **Step 3: Add .data/ to .gitignore**

Append to `dashboard/.gitignore`:
```
# SQLite data
.data/
```

- [ ] **Step 4: Verify build still works**

```bash
cd dashboard && npm run build
```
Expected: Build succeeds with no errors.

- [ ] **Step 5: Commit**

```bash
git add dashboard/package.json dashboard/package-lock.json dashboard/next.config.ts dashboard/.gitignore
git commit -m "chore: add better-sqlite3 dependency and Next.js config for agent workstation"
```

---

## Task 2: Types & Agent Definitions

**Files:**
- Modify: `dashboard/src/types/chat.ts`
- Create: `dashboard/src/lib/agents/types.ts`
- Create: `dashboard/src/lib/agents/definitions.ts`

- [ ] **Step 1: Add ClaudeModel and agent types to chat.ts**

Append to `dashboard/src/types/chat.ts` (single source of truth for ClaudeModel):
```typescript
// --- Shared model type ---
export type ClaudeModel = "opus" | "sonnet" | "haiku";

// --- Agent-related types (Phase 1) ---

export interface AgentTab {
  id: string;
  agentType: string;
  status: "idle" | "streaming" | "queued" | "error";
  sessionId: string | null;
  processId: string | null;
}

export interface ActivityEvent {
  id: string;
  processId: string;
  agentType: string;
  toolName: string;
  toolInput?: string;
  toolOutput?: string;
  timestamp: number;
}
```

- [ ] **Step 2: Create agent-specific types**

Create `dashboard/src/lib/agents/types.ts`:
```typescript
import type { PermissionMode, ClaudeModel } from "@/types/chat";

export type AgentStatus = "idle" | "streaming" | "queued" | "error";

export interface AgentDefinition {
  id: string;
  name: string;
  description: string;
  icon: string;               // Lucide icon name (for reference; UI maps separately)
  color: string;              // Tailwind color class
  systemPrompt: string;
  model: ClaudeModel;
  permissionMode: PermissionMode;
  allowedTools?: string[];    // Phase 2: --allowed-tools CLI flag
  contextDirs?: string[];     // extra --add-dir paths
}

export interface SpawnOptions {
  agentType: string;
  prompt: string;
  sessionId?: string | null;
  model?: ClaudeModel;
  permissionMode?: PermissionMode;
  systemPrompt?: string;
  contextDirs?: string[];
}

export interface AgentProcess {
  id: string;                 // unique process ID
  agentType: string;
  sessionId: string | null;
  status: AgentStatus;
  pid: number | null;
  startedAt: number;
}

export type AgentEventType = "text" | "tool_use" | "tool_result" | "session" | "error" | "done";

export interface AgentEvent {
  type: AgentEventType;
  processId: string;
  content?: string;
  toolName?: string;
  toolInput?: string;
  toolOutput?: string;
  sessionId?: string;
  timestamp: number;
}
```

- [ ] **Step 3: Create agent definitions**

Create `dashboard/src/lib/agents/definitions.ts`:
```typescript
import type { AgentDefinition } from "./types";

const VAULT =
  "/Users/username/Library/CloudStorage/GoogleDrive-user@gmail.com/我的雲端硬碟/Obsidian-Cyclone";

export const AGENT_DEFINITIONS: Record<string, AgentDefinition> = {
  researcher: {
    id: "researcher",
    name: "Researcher",
    description: "搜尋 Obsidian vault + web search，產出研究筆記",
    icon: "BookOpen",
    color: "text-purple-400",
    systemPrompt: `你是 CycloneOS 的研究助理。工作流程：
1. 根據使用者主題，搜尋 Obsidian vault 中的相關筆記
2. 如需外部資訊，使用 web search
3. 整合後產出結構化研究摘要
4. 格式：## 摘要 → ## 關鍵發現 → ## 來源列表

Obsidian vault 路徑已透過 --add-dir 提供。
優先搜尋 Draco/cron/ 和 Draco/research/ 目錄。`,
    model: "opus",
    permissionMode: "default",
    contextDirs: [VAULT],
  },
  writer: {
    id: "writer",
    name: "Writer",
    description: "產出文件、文章、session log",
    icon: "PenTool",
    color: "text-emerald-400",
    systemPrompt: `你是 CycloneOS 的寫作助理。工作流程：
1. 根據使用者需求，撰寫結構化文件
2. 使用 Traditional Chinese
3. 風格：專業、簡潔、重點清晰
4. 可搜尋 vault 作為參考資料

Obsidian vault 路徑已透過 --add-dir 提供。`,
    model: "opus",
    permissionMode: "default",
    contextDirs: [VAULT],
  },
  general: {
    id: "general",
    name: "General",
    description: "通用對話（現有 Chat 升級版）",
    icon: "MessageCircle",
    color: "text-cy-accent",
    systemPrompt: `你是 CycloneOS 的通用助理。可以回答各種問題、提供建議、協助分析。
Obsidian vault 路徑已透過 --add-dir 提供，可搜尋使用者的筆記。`,
    model: "sonnet",
    permissionMode: "default",
    contextDirs: [VAULT],
  },
  coder: {
    id: "coder",
    name: "Coder",
    description: "寫程式、改 code、建檔案",
    icon: "Code",
    color: "text-amber-400",
    systemPrompt: `你是 CycloneOS 的程式開發助理。
工作目錄是 /Users/username/CycloneOpenClaw。
遵循 CLAUDE.md 中的專案規範。`,
    model: "sonnet",
    permissionMode: "acceptEdits",
  },
  "code-reviewer": {
    id: "code-reviewer",
    name: "Reviewer",
    description: "審查 git diff/PR，產出 review",
    icon: "GitPullRequest",
    color: "text-pink-400",
    systemPrompt: `你是 CycloneOS 的程式碼審查員。
1. 審查 git diff 或指定檔案
2. 產出結構化 review：## 摘要 → ## 問題 → ## 建議
3. 重點：安全性、效能、可維護性`,
    model: "sonnet",
    permissionMode: "default",
  },
  "test-runner": {
    id: "test-runner",
    name: "Tester",
    description: "跑測試、分析失敗",
    icon: "FlaskConical",
    color: "text-sky-400",
    systemPrompt: `你是 CycloneOS 的測試助理。
1. 執行指定的測試指令
2. 分析失敗原因
3. 產出修復建議`,
    model: "sonnet",
    permissionMode: "default",
  },
};

export function getAgentDefinition(agentType: string): AgentDefinition | undefined {
  return AGENT_DEFINITIONS[agentType];
}

export function listAgentTypes(): string[] {
  return Object.keys(AGENT_DEFINITIONS);
}
```

- [ ] **Step 4: Update chat-store to import ClaudeModel from types**

In `dashboard/src/stores/chat-store.ts`, replace the local `ClaudeModel` type:
```typescript
// Remove: export type ClaudeModel = "opus" | "sonnet" | "haiku";
// Add:
import type { ChatMessage, SessionInfo, PermissionMode, ClaudeModel } from "@/types/chat";
export type { ClaudeModel };
```

- [ ] **Step 5: Commit**

```bash
git add dashboard/src/types/chat.ts dashboard/src/lib/agents/ dashboard/src/stores/chat-store.ts
git commit -m "feat(agent): add agent type definitions and 6 agent role configs"
```

---

## Task 3: Extend claude-bridge with systemPrompt support

**Files:**
- Modify: `dashboard/src/lib/claude-bridge.ts`

- [ ] **Step 1: Add appendSystemPrompt to options**

Update `dashboard/src/lib/claude-bridge.ts` — add `appendSystemPrompt` and `extraContextDirs` to the interface and arg builder:

```typescript
import { spawn, type ChildProcess } from "child_process";
import type { PermissionMode } from "@/types/chat";

const CWD = "/Users/username/CycloneOpenClaw";
const VAULT =
  "/Users/username/Library/CloudStorage/GoogleDrive-user@gmail.com/我的雲端硬碟/Obsidian-Cyclone";

export interface ClaudeBridgeOptions {
  prompt: string;
  sessionId?: string | null;
  permissionMode?: PermissionMode;
  model?: string;
  appendSystemPrompt?: string;
  extraContextDirs?: string[];
}

export function spawnClaude(options: ClaudeBridgeOptions): ChildProcess {
  const args = [
    "--print",
    "--verbose",
    "--output-format",
    "stream-json",
    "--permission-mode",
    options.permissionMode ?? "acceptEdits",
  ];

  if (options.model) {
    args.push("--model", options.model);
  }

  if (options.sessionId) {
    args.push("--resume", options.sessionId);
  }

  if (options.appendSystemPrompt) {
    args.push("--append-system-prompt", options.appendSystemPrompt);
  }

  // Default vault dir
  args.push("--add-dir", VAULT);

  // Extra context directories (agent-specific)
  if (options.extraContextDirs) {
    for (const dir of options.extraContextDirs) {
      if (dir !== VAULT) {
        args.push("--add-dir", dir);
      }
    }
  }

  args.push("--", options.prompt);

  return spawn("claude", args, {
    cwd: CWD,
    env: { ...process.env },
    stdio: ["ignore", "pipe", "pipe"],
  });
}

export async function checkClaudeHealth(): Promise<boolean> {
  return new Promise((resolve) => {
    const proc = spawn("claude", ["--version"], { stdio: "pipe" });
    proc.on("close", (code) => resolve(code === 0));
    proc.on("error", () => resolve(false));
    setTimeout(() => {
      proc.kill();
      resolve(false);
    }, 5000);
  });
}
```

- [ ] **Step 2: Verify existing /api/chat still works**

```bash
cd dashboard && npm run build
```
Expected: Build succeeds. Existing chat API unchanged (it doesn't pass appendSystemPrompt).

- [ ] **Step 3: Commit**

```bash
git add dashboard/src/lib/claude-bridge.ts
git commit -m "feat(agent): extend claude-bridge with appendSystemPrompt and extraContextDirs"
```

---

## Task 4: EventBus

**Files:**
- Create: `dashboard/src/lib/event-bus.ts`

- [ ] **Step 1: Create EventBus**

Create `dashboard/src/lib/event-bus.ts`. Uses `globalThis` to survive Next.js HMR:

```typescript
import { EventEmitter } from "events";
import type { AgentEvent } from "./agents/types";

/**
 * Central event bus for all agent stream events.
 * Server-side singleton — each agent process emits events here,
 * and SSE routes subscribe to forward events to clients.
 */
class AgentEventBus extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(50); // headroom for 4 agents × multiple listeners + browser tabs
  }

  /** Emit an event for a specific agent process */
  emitAgentEvent(event: AgentEvent): void {
    this.emit(`agent:${event.processId}`, event);
    this.emit("agent:*", event); // wildcard for activity feed
  }

  /** Subscribe to events for a specific process */
  onProcessEvent(processId: string, handler: (event: AgentEvent) => void): void {
    this.on(`agent:${processId}`, handler);
  }

  /** Unsubscribe from process events */
  offProcessEvent(processId: string, handler: (event: AgentEvent) => void): void {
    this.off(`agent:${processId}`, handler);
  }

  /** Subscribe to all agent events (for activity feed) */
  onAllEvents(handler: (event: AgentEvent) => void): void {
    this.on("agent:*", handler);
  }

  offAllEvents(handler: (event: AgentEvent) => void): void {
    this.off("agent:*", handler);
  }
}

// Survive Next.js HMR by persisting on globalThis
const g = globalThis as unknown as { __agentEventBus?: AgentEventBus };
export const eventBus: AgentEventBus = g.__agentEventBus ??= new AgentEventBus();
```

- [ ] **Step 2: Commit**

```bash
git add dashboard/src/lib/event-bus.ts
git commit -m "feat(agent): add EventBus for agent process event routing"
```

---

## Task 5: Executor Interface + LocalExecutor

**Files:**
- Create: `dashboard/src/lib/executors/executor.ts`
- Create: `dashboard/src/lib/executors/local-executor.ts`

- [ ] **Step 1: Create Executor interface**

Create `dashboard/src/lib/executors/executor.ts`:
```typescript
import type { ChildProcess } from "child_process";
import type { SpawnOptions } from "../agents/types";

export interface ExecutorProcess {
  id: string;
  childProcess: ChildProcess;
  agentType: string;
}

export interface Executor {
  spawn(processId: string, options: SpawnOptions): ExecutorProcess;
  kill(processId: string): void;
}
```

- [ ] **Step 2: Create LocalExecutor**

Create `dashboard/src/lib/executors/local-executor.ts`:
```typescript
import type { Executor, ExecutorProcess } from "./executor";
import type { SpawnOptions } from "../agents/types";
import { spawnClaude } from "../claude-bridge";
import { eventBus } from "../event-bus";

export class LocalExecutor implements Executor {
  private processes = new Map<string, ExecutorProcess>();

  spawn(processId: string, options: SpawnOptions): ExecutorProcess {
    const proc = spawnClaude({
      prompt: options.prompt,
      sessionId: options.sessionId,
      permissionMode: options.permissionMode,
      model: options.model,
      appendSystemPrompt: options.systemPrompt,
      extraContextDirs: options.contextDirs,
    });

    const execProc: ExecutorProcess = {
      id: processId,
      childProcess: proc,
      agentType: options.agentType,
    };
    this.processes.set(processId, execProc);

    this.attachStreamParser(processId, proc);

    proc.on("close", () => {
      this.processes.delete(processId);
    });

    proc.on("error", (err) => {
      eventBus.emitAgentEvent({
        type: "error",
        processId,
        content: `Failed to start claude: ${err.message}`,
        timestamp: Date.now(),
      });
      this.processes.delete(processId);
    });

    return execProc;
  }

  kill(processId: string): void {
    const proc = this.processes.get(processId);
    if (proc) {
      proc.childProcess.kill();
      this.processes.delete(processId);
    }
  }

  private attachStreamParser(
    processId: string,
    proc: import("child_process").ChildProcess
  ): void {
    let buffer = "";
    let lastActivity = Date.now();

    proc.stdout?.on("data", (chunk: Buffer) => {
      lastActivity = Date.now();
      buffer += chunk.toString();
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const event = JSON.parse(line);
          this.parseStreamEvent(processId, event);
        } catch {
          // Non-JSON line, skip
        }
      }
    });

    proc.stderr?.on("data", (chunk: Buffer) => {
      const text = chunk.toString().trim();
      if (text) {
        eventBus.emitAgentEvent({
          type: "error",
          processId,
          content: text,
          timestamp: Date.now(),
        });
      }
    });

    proc.on("close", (code) => {
      if (code !== 0) {
        eventBus.emitAgentEvent({
          type: "error",
          processId,
          content: `Process exited with code ${code}`,
          timestamp: Date.now(),
        });
      }
      eventBus.emitAgentEvent({
        type: "done",
        processId,
        timestamp: Date.now(),
      });
    });

    // Inactivity timeout: 120s
    const timeoutCheck = setInterval(() => {
      if (!this.processes.has(processId)) {
        clearInterval(timeoutCheck);
        return;
      }
      if (Date.now() - lastActivity > 120_000) {
        eventBus.emitAgentEvent({
          type: "error",
          processId,
          content: "Response timeout (120s no output)",
          timestamp: Date.now(),
        });
        this.kill(processId);
        clearInterval(timeoutCheck);
      }
    }, 10_000);

    proc.on("close", () => clearInterval(timeoutCheck));
  }

  private parseStreamEvent(
    processId: string,
    event: Record<string, unknown>
  ): void {
    const now = Date.now();

    // Session ID from init
    if (event.type === "system" && event.subtype === "init" && event.session_id) {
      eventBus.emitAgentEvent({
        type: "session",
        processId,
        sessionId: event.session_id as string,
        timestamp: now,
      });
    }

    // Text content from assistant message
    if (event.type === "assistant" && event.message) {
      const msg = event.message as { content?: Array<{ type: string; text?: string; name?: string; input?: unknown }> };
      if (Array.isArray(msg.content)) {
        for (const block of msg.content) {
          if (block.type === "text" && block.text) {
            eventBus.emitAgentEvent({
              type: "text",
              processId,
              content: block.text,
              timestamp: now,
            });
          }
          if (block.type === "tool_use" && block.name) {
            eventBus.emitAgentEvent({
              type: "tool_use",
              processId,
              toolName: block.name,
              toolInput: JSON.stringify(block.input).slice(0, 500),
              timestamp: now,
            });
          }
        }
      }
    }

    // Streaming text delta
    if (event.type === "content_block_delta") {
      const delta = event.delta as { type?: string; text?: string } | undefined;
      if (delta?.type === "text_delta" && delta.text) {
        eventBus.emitAgentEvent({
          type: "text",
          processId,
          content: delta.text,
          timestamp: now,
        });
      }
    }

    // Result event (final) — capture session ID
    if (event.type === "result") {
      const sessionId = event.session_id as string | undefined;
      if (sessionId) {
        eventBus.emitAgentEvent({
          type: "session",
          processId,
          sessionId,
          timestamp: now,
        });
      }
    }
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add dashboard/src/lib/executors/
git commit -m "feat(agent): add Executor interface and LocalExecutor with stream parsing"
```

---

## Task 6: SessionStore (SQLite)

**Files:**
- Create: `dashboard/src/lib/session-store.ts`

- [ ] **Step 1: Create SessionStore**

Create `dashboard/src/lib/session-store.ts`. Uses absolute path and `globalThis` for HMR safety:

```typescript
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

// Use absolute path to avoid process.cwd() ambiguity
const DASHBOARD_ROOT = path.resolve("/Users/username/CycloneOpenClaw/dashboard");
const DATA_DIR = path.join(DASHBOARD_ROOT, ".data");
const DB_PATH = path.join(DATA_DIR, "sessions.db");

class SessionStore {
  private db: Database.Database;

  constructor() {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    this.db = new Database(DB_PATH);
    this.db.pragma("journal_mode = WAL");
    this.migrate();
  }

  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        agent_type TEXT NOT NULL,
        title TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        message_count INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL REFERENCES sessions(id),
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        timestamp INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS activities (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL REFERENCES sessions(id),
        tool_name TEXT NOT NULL,
        tool_input TEXT,
        tool_output TEXT,
        timestamp INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id);
      CREATE INDEX IF NOT EXISTS idx_activities_session ON activities(session_id);
    `);
  }

  // --- Sessions ---

  upsertSession(id: string, agentType: string, title?: string): void {
    const now = Date.now();
    this.db.prepare(`
      INSERT INTO sessions (id, agent_type, title, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET updated_at = ?, title = COALESCE(?, title)
    `).run(id, agentType, title ?? null, now, now, now, title ?? null);
  }

  listSessions(limit = 100): Array<{
    id: string;
    agentType: string;
    title: string | null;
    createdAt: number;
    updatedAt: number;
    messageCount: number;
  }> {
    return this.db.prepare(`
      SELECT id, agent_type as agentType, title, created_at as createdAt,
             updated_at as updatedAt, message_count as messageCount
      FROM sessions ORDER BY updated_at DESC LIMIT ?
    `).all(limit) as Array<{
      id: string;
      agentType: string;
      title: string | null;
      createdAt: number;
      updatedAt: number;
      messageCount: number;
    }>;
  }

  // --- Messages ---

  addMessage(sessionId: string, role: string, content: string): string {
    const id = crypto.randomUUID();
    const now = Date.now();
    this.db.prepare(`
      INSERT INTO messages (id, session_id, role, content, timestamp) VALUES (?, ?, ?, ?, ?)
    `).run(id, sessionId, role, content, now);

    this.db.prepare(`
      UPDATE sessions SET message_count = message_count + 1, updated_at = ? WHERE id = ?
    `).run(now, sessionId);

    return id;
  }

  getMessages(sessionId: string): Array<{
    id: string;
    role: string;
    content: string;
    timestamp: number;
  }> {
    return this.db.prepare(`
      SELECT id, role, content, timestamp FROM messages
      WHERE session_id = ? ORDER BY timestamp ASC
    `).all(sessionId) as Array<{
      id: string;
      role: string;
      content: string;
      timestamp: number;
    }>;
  }

  // --- Activities ---

  addActivity(
    sessionId: string,
    toolName: string,
    toolInput?: string,
    toolOutput?: string
  ): void {
    this.db.prepare(`
      INSERT INTO activities (session_id, tool_name, tool_input, tool_output, timestamp)
      VALUES (?, ?, ?, ?, ?)
    `).run(sessionId, toolName, toolInput ?? null, toolOutput ?? null, Date.now());
  }

  getActivities(sessionId: string, limit = 200): Array<{
    id: number;
    toolName: string;
    toolInput: string | null;
    toolOutput: string | null;
    timestamp: number;
  }> {
    return this.db.prepare(`
      SELECT id, tool_name as toolName, tool_input as toolInput,
             tool_output as toolOutput, timestamp
      FROM activities WHERE session_id = ? ORDER BY timestamp DESC LIMIT ?
    `).all(sessionId, limit) as Array<{
      id: number;
      toolName: string;
      toolInput: string | null;
      toolOutput: string | null;
      timestamp: number;
    }>;
  }
}

// Survive Next.js HMR
const g = globalThis as unknown as { __sessionStore?: SessionStore };
export const sessionStore: SessionStore = g.__sessionStore ??= new SessionStore();
```

- [ ] **Step 2: Verify build**

```bash
cd dashboard && npm run build
```
Expected: Build succeeds. SQLite loads as external package.

- [ ] **Step 3: Commit**

```bash
git add dashboard/src/lib/session-store.ts
git commit -m "feat(agent): add SQLite SessionStore for session/message/activity persistence"
```

---

## Task 7: AgentManager

**Files:**
- Create: `dashboard/src/lib/agent-manager.ts`

- [ ] **Step 1: Create AgentManager**

Create `dashboard/src/lib/agent-manager.ts`. Key fixes from review:
- `dispatch()` is synchronous — returns `processId` immediately, queued agents get "queued" status
- Named handler reference for proper cleanup (no listener leak)
- Error status preserved when "done" fires after "error"

```typescript
import { LocalExecutor } from "./executors/local-executor";
import type { ExecutorProcess } from "./executors/executor";
import { getAgentDefinition } from "./agents/definitions";
import type { AgentProcess, AgentEvent } from "./agents/types";
import { eventBus } from "./event-bus";
import { sessionStore } from "./session-store";

const MAX_CONCURRENT = 4;

interface QueueItem {
  processId: string;
  agentType: string;
  prompt: string;
  sessionId?: string | null;
}

class AgentManager {
  private executor = new LocalExecutor();
  private active = new Map<string, { exec: ExecutorProcess; agent: AgentProcess }>();
  private queue: QueueItem[] = [];

  dispatch(agentType: string, prompt: string, sessionId?: string | null): string {
    const def = getAgentDefinition(agentType);
    if (!def) throw new Error(`Unknown agent type: ${agentType}`);

    const processId = crypto.randomUUID().slice(0, 12);

    if (this.active.size >= MAX_CONCURRENT) {
      // Queue — return processId immediately. SSE subscriber will wait for events
      // once the queue drains and the process actually starts.
      this.queue.push({ processId, agentType, prompt, sessionId });
      return processId;
    }

    this.startProcess(processId, agentType, prompt, sessionId ?? null, def.systemPrompt);
    return processId;
  }

  private startProcess(
    processId: string,
    agentType: string,
    prompt: string,
    sessionId: string | null,
    systemPrompt: string
  ): void {
    const def = getAgentDefinition(agentType)!;

    const exec = this.executor.spawn(processId, {
      agentType,
      prompt,
      sessionId,
      model: def.model,
      permissionMode: def.permissionMode,
      systemPrompt,
      contextDirs: def.contextDirs,
    });

    const agent: AgentProcess = {
      id: processId,
      agentType,
      sessionId,
      status: "streaming",
      pid: exec.childProcess.pid ?? null,
      startedAt: Date.now(),
    };

    this.active.set(processId, { exec, agent });

    // Named handler for proper cleanup (avoids listener leak)
    const handler = (event: AgentEvent) => {
      if (event.type === "session" && event.sessionId) {
        agent.sessionId = event.sessionId;
        sessionStore.upsertSession(event.sessionId, agentType);
      }
      if (event.type === "tool_use" && agent.sessionId) {
        sessionStore.addActivity(
          agent.sessionId,
          event.toolName ?? "unknown",
          event.toolInput
        );
      }
      if (event.type === "error") {
        agent.status = "error";
      }
      if (event.type === "done") {
        // Preserve error status if process errored before done
        if (agent.status !== "error") {
          agent.status = "idle";
        }
        this.active.delete(processId);
        eventBus.offProcessEvent(processId, handler);
        this.drainQueue();
      }
    };

    eventBus.onProcessEvent(processId, handler);
  }

  stop(processId: string): boolean {
    const entry = this.active.get(processId);
    if (!entry) return false;
    this.executor.kill(processId);
    entry.agent.status = "idle";
    this.active.delete(processId);
    this.drainQueue();
    return true;
  }

  getProcess(processId: string): AgentProcess | undefined {
    return this.active.get(processId)?.agent;
  }

  listActive(): AgentProcess[] {
    return Array.from(this.active.values()).map((v) => v.agent);
  }

  getPoolStatus(): { active: number; queued: number; maxConcurrent: number } {
    return {
      active: this.active.size,
      queued: this.queue.length,
      maxConcurrent: MAX_CONCURRENT,
    };
  }

  private drainQueue(): void {
    if (this.queue.length === 0 || this.active.size >= MAX_CONCURRENT) return;
    const next = this.queue.shift()!;
    const def = getAgentDefinition(next.agentType);
    if (def) {
      this.startProcess(
        next.processId,
        next.agentType,
        next.prompt,
        next.sessionId ?? null,
        def.systemPrompt
      );
    }
  }
}

// Survive Next.js HMR
const g = globalThis as unknown as { __agentManager?: AgentManager };
export const agentManager: AgentManager = g.__agentManager ??= new AgentManager();
```

- [ ] **Step 2: Verify build**

```bash
cd dashboard && npm run build
```

- [ ] **Step 3: Commit**

```bash
git add dashboard/src/lib/agent-manager.ts
git commit -m "feat(agent): add AgentManager with ProcessPool (max 4) and queue"
```

---

## Task 8: API Routes

**Files:**
- Create: `dashboard/src/app/api/agents/dispatch/route.ts`
- Create: `dashboard/src/app/api/agents/stop/route.ts`
- Create: `dashboard/src/app/api/agents/sessions/route.ts`

**Note:** Dispatch and SSE stream are combined in a single POST endpoint (like existing `/api/chat`). This eliminates the race condition where events are emitted before the SSE subscriber connects. The processId is sent as the first SSE event.

- [ ] **Step 1: Create dispatch route (combined dispatch + SSE stream)**

Create `dashboard/src/app/api/agents/dispatch/route.ts`:
```typescript
import { NextRequest } from "next/server";
import { agentManager } from "@/lib/agent-manager";
import { eventBus } from "@/lib/event-bus";
import type { AgentEvent } from "@/lib/agents/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { agentType, prompt, sessionId } = body;

  if (!agentType || !prompt) {
    return Response.json({ error: "Missing agentType or prompt" }, { status: 400 });
  }

  let processId: string;
  try {
    processId = agentManager.dispatch(agentType, prompt, sessionId);
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 400 });
  }

  // Return SSE stream (combined dispatch + stream, no race condition)
  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      let closed = false;

      const send = (data: Record<string, unknown>) => {
        if (closed) return;
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      // Send processId as first event so frontend can use it for stop
      send({ type: "process", processId });

      const handler = (event: AgentEvent) => {
        send({
          type: event.type,
          content: event.content,
          toolName: event.toolName,
          toolInput: event.toolInput,
          toolOutput: event.toolOutput,
          sessionId: event.sessionId,
          timestamp: event.timestamp,
        });

        if (event.type === "done") {
          if (!closed) {
            closed = true;
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            controller.close();
          }
          eventBus.offProcessEvent(processId, handler);
        }
      };

      eventBus.onProcessEvent(processId, handler);

      // Cleanup if client disconnects
      req.signal.addEventListener("abort", () => {
        closed = true;
        eventBus.offProcessEvent(processId, handler);
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
```

- [ ] **Step 2: Create stop route**

Create `dashboard/src/app/api/agents/stop/route.ts`:
```typescript
import { NextRequest } from "next/server";
import { agentManager } from "@/lib/agent-manager";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { processId } = body;

  if (!processId) {
    return Response.json({ error: "Missing processId" }, { status: 400 });
  }

  const success = agentManager.stop(processId);
  return Response.json({ success });
}
```

- [ ] **Step 3: Create sessions route**

Create `dashboard/src/app/api/agents/sessions/route.ts`:
```typescript
import { sessionStore } from "@/lib/session-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const sessions = sessionStore.listSessions();
  return Response.json({ sessions });
}
```

- [ ] **Step 4: Verify build**

```bash
cd dashboard && npm run build
```

- [ ] **Step 5: Commit**

```bash
git add dashboard/src/app/api/agents/
git commit -m "feat(agent): add API routes — dispatch+SSE (combined), stop, sessions"
```

---

## Task 9: Agent Store (Zustand)

**Files:**
- Create: `dashboard/src/stores/agent-store.ts`

- [ ] **Step 1: Create agent store**

Create `dashboard/src/stores/agent-store.ts`:
```typescript
import { create } from "zustand";
import type { ChatMessage, AgentTab, ActivityEvent, PermissionMode, ClaudeModel } from "@/types/chat";

const MAX_ACTIVITIES = 200;

interface AgentStoreState {
  // Tab management
  tabs: AgentTab[];
  activeTabId: string;

  // Per-tab messages
  messagesByTab: Record<string, ChatMessage[]>;

  // Activity feed
  activities: ActivityEvent[];

  // UI state
  isActivityOpen: boolean;
  isHistoryOpen: boolean;

  // Global settings (kept in sync with chat-store until Phase 3 migration)
  permissionMode: PermissionMode;
  model: ClaudeModel;
  enterToSend: boolean;

  // Actions: tabs
  addTab: (agentType: string) => string;
  removeTab: (tabId: string) => void;
  setActiveTab: (tabId: string) => void;
  setTabStatus: (tabId: string, status: AgentTab["status"]) => void;
  setTabProcessId: (tabId: string, processId: string | null) => void;
  setTabSessionId: (tabId: string, sessionId: string) => void;

  // Actions: messages
  addMessage: (tabId: string, msg: ChatMessage) => void;
  appendToLastAssistant: (tabId: string, text: string) => void;
  clearTabMessages: (tabId: string) => void;

  // Actions: activities
  addActivity: (event: ActivityEvent) => void;

  // Actions: UI
  toggleActivity: () => void;
  toggleHistory: () => void;

  // Actions: settings
  setPermissionMode: (mode: PermissionMode) => void;
  setModel: (model: ClaudeModel) => void;
  setEnterToSend: (v: boolean) => void;
}

const DEFAULT_TAB_ID = "default-general";

export const useAgentStore = create<AgentStoreState>((set) => ({
  tabs: [{ id: DEFAULT_TAB_ID, agentType: "general", status: "idle", sessionId: null, processId: null }],
  activeTabId: DEFAULT_TAB_ID,
  messagesByTab: { [DEFAULT_TAB_ID]: [] },
  activities: [],
  isActivityOpen: false,
  isHistoryOpen: false,
  permissionMode: "acceptEdits",
  model: "sonnet",
  enterToSend: true,

  addTab: (agentType) => {
    const id = crypto.randomUUID().slice(0, 8);
    set((s) => ({
      tabs: [...s.tabs, { id, agentType, status: "idle", sessionId: null, processId: null }],
      activeTabId: id,
      messagesByTab: { ...s.messagesByTab, [id]: [] },
    }));
    return id;
  },

  removeTab: (tabId) =>
    set((s) => {
      const remaining = s.tabs.filter((t) => t.id !== tabId);
      if (remaining.length === 0) return s;
      const newMessages = { ...s.messagesByTab };
      delete newMessages[tabId];
      return {
        tabs: remaining,
        activeTabId: s.activeTabId === tabId ? remaining[0].id : s.activeTabId,
        messagesByTab: newMessages,
      };
    }),

  setActiveTab: (tabId) => set({ activeTabId: tabId }),

  setTabStatus: (tabId, status) =>
    set((s) => ({
      tabs: s.tabs.map((t) => (t.id === tabId ? { ...t, status } : t)),
    })),

  setTabProcessId: (tabId, processId) =>
    set((s) => ({
      tabs: s.tabs.map((t) => (t.id === tabId ? { ...t, processId } : t)),
    })),

  setTabSessionId: (tabId, sessionId) =>
    set((s) => ({
      tabs: s.tabs.map((t) => (t.id === tabId ? { ...t, sessionId } : t)),
    })),

  addMessage: (tabId, msg) =>
    set((s) => ({
      messagesByTab: {
        ...s.messagesByTab,
        [tabId]: [...(s.messagesByTab[tabId] ?? []), msg],
      },
    })),

  appendToLastAssistant: (tabId, text) =>
    set((s) => {
      const msgs = [...(s.messagesByTab[tabId] ?? [])];
      const last = msgs[msgs.length - 1];
      if (last?.role === "assistant") {
        msgs[msgs.length - 1] = { ...last, content: last.content + text };
      }
      return { messagesByTab: { ...s.messagesByTab, [tabId]: msgs } };
    }),

  clearTabMessages: (tabId) =>
    set((s) => ({
      messagesByTab: { ...s.messagesByTab, [tabId]: [] },
    })),

  addActivity: (event) =>
    set((s) => {
      const activities = [event, ...s.activities].slice(0, MAX_ACTIVITIES);
      return { activities };
    }),

  toggleActivity: () => set((s) => ({ isActivityOpen: !s.isActivityOpen })),
  toggleHistory: () => set((s) => ({ isHistoryOpen: !s.isHistoryOpen })),

  setPermissionMode: (mode) => set({ permissionMode: mode }),
  setModel: (model) => set({ model }),
  setEnterToSend: (v) => set({ enterToSend: v }),
}));
```

- [ ] **Step 2: Commit**

```bash
git add dashboard/src/stores/agent-store.ts
git commit -m "feat(agent): add Zustand agent-store for multi-tab agent state management"
```

---

## Task 10: Connect UI — AgentTabs

**Files:**
- Modify: `dashboard/src/components/chat/agent-tabs.tsx`

**Note:** This task and Task 12 are coupled — both must be implemented together because AgentTabs removes its props interface while ChatPanel stops passing props.

- [ ] **Step 1: Rewrite AgentTabs to use agent-store**

Replace `dashboard/src/components/chat/agent-tabs.tsx`:
```typescript
"use client";

import {
  BookOpen, PenTool, MessageCircle, Code, GitPullRequest, FlaskConical,
  Plus, X, History,
} from "lucide-react";
import { useAgentStore } from "@/stores/agent-store";
import { useState } from "react";

const AGENT_UI = {
  researcher:      { name: "Researcher", icon: BookOpen,       color: "text-purple-400" },
  writer:          { name: "Writer",     icon: PenTool,        color: "text-emerald-400" },
  general:         { name: "General",    icon: MessageCircle,  color: "text-cy-accent" },
  coder:           { name: "Coder",      icon: Code,           color: "text-amber-400" },
  "code-reviewer": { name: "Reviewer",   icon: GitPullRequest, color: "text-pink-400" },
  "test-runner":   { name: "Tester",     icon: FlaskConical,   color: "text-sky-400" },
} as const;

const AGENT_LIST = Object.entries(AGENT_UI).map(([id, ui]) => ({ id, ...ui }));

export function AgentTabs() {
  const { tabs, activeTabId, isActivityOpen, addTab, removeTab, setActiveTab, toggleActivity, toggleHistory } = useAgentStore();
  const [pickerOpen, setPickerOpen] = useState(false);

  function handleAddAgent(agentType: string) {
    addTab(agentType);
    setPickerOpen(false);
  }

  return (
    <div className="relative">
      <div className="flex items-center gap-0.5 border-b border-cy-border bg-cy-bg/80 px-1 py-1">
        {tabs.map((tab) => {
          const ui = AGENT_UI[tab.agentType as keyof typeof AGENT_UI];
          if (!ui) return null;
          const Icon = ui.icon;
          const isActive = activeTabId === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`group flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] transition-colors ${
                isActive
                  ? "bg-cy-input/60 text-cy-text"
                  : "text-cy-muted hover:bg-cy-input/30 hover:text-cy-text"
              }`}
            >
              <span className="relative">
                <Icon className={`h-3.5 w-3.5 ${ui.color}`} strokeWidth={1.8} />
                <span
                  className={`absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full ${
                    tab.status === "streaming"
                      ? "bg-blue-400 animate-pulse"
                      : tab.status === "queued"
                        ? "bg-yellow-400 animate-pulse"
                        : tab.status === "error"
                          ? "bg-red-400"
                          : "bg-emerald-400"
                  }`}
                />
              </span>
              <span>{ui.name}</span>
              {tabs.length > 1 && (
                <X
                  className="h-3 w-3 opacity-0 group-hover:opacity-60 hover:!opacity-100"
                  strokeWidth={1.8}
                  onClick={(e) => {
                    e.stopPropagation();
                    removeTab(tab.id);
                  }}
                />
              )}
            </button>
          );
        })}

        <button
          onClick={() => setPickerOpen(!pickerOpen)}
          className="flex items-center justify-center rounded-md p-1 text-cy-muted transition-colors hover:bg-cy-input/30 hover:text-cy-text"
          title="New Agent"
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={1.8} />
        </button>

        <div className="flex-1" />

        <button
          onClick={toggleHistory}
          className="rounded-md p-1 text-cy-muted transition-colors hover:bg-cy-input/30 hover:text-cy-text"
          title="Session History"
        >
          <History className="h-3.5 w-3.5" strokeWidth={1.8} />
        </button>

        <button
          onClick={toggleActivity}
          className={`rounded-md p-1 text-[11px] transition-colors ${
            isActivityOpen
              ? "bg-cy-accent/20 text-cy-accent"
              : "text-cy-muted hover:bg-cy-input/30 hover:text-cy-text"
          }`}
          title="Activity Feed"
        >
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
          </svg>
        </button>
      </div>

      {pickerOpen && (
        <div className="absolute left-0 right-0 top-full z-50 border-b border-cy-border bg-cy-bg/95 p-2 backdrop-blur-md">
          <div className="grid grid-cols-3 gap-1.5">
            {AGENT_LIST.map((def) => {
              const Icon = def.icon;
              return (
                <button
                  key={def.id}
                  onClick={() => handleAddAgent(def.id)}
                  className="flex flex-col items-center gap-1 rounded-lg border border-white/5 bg-cy-card/60 px-2 py-2.5 transition-all hover:border-cy-accent/30 hover:bg-cy-card"
                >
                  <Icon className={`h-5 w-5 ${def.color}`} strokeWidth={1.8} />
                  <span className="text-[10px] text-cy-text">{def.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add dashboard/src/components/chat/agent-tabs.tsx
git commit -m "feat(agent): connect AgentTabs to Zustand agent-store"
```

---

## Task 11: Connect UI — ActivityFeed

**Files:**
- Modify: `dashboard/src/components/chat/activity-feed.tsx`

- [ ] **Step 1: Rewrite ActivityFeed to use agent-store**

Replace `dashboard/src/components/chat/activity-feed.tsx`:
```typescript
"use client";

import {
  BookOpen, Code, Terminal, Search, FileEdit, Globe,
  MessageCircle, PenTool, GitPullRequest, FlaskConical, File,
} from "lucide-react";
import { useAgentStore } from "@/stores/agent-store";
import type { ActivityEvent } from "@/types/chat";
import type { ElementType } from "react";

const AGENT_UI: Record<string, { name: string; icon: ElementType; color: string }> = {
  researcher:      { name: "Researcher", icon: BookOpen,       color: "text-purple-400" },
  writer:          { name: "Writer",     icon: PenTool,        color: "text-emerald-400" },
  general:         { name: "General",    icon: MessageCircle,  color: "text-cy-accent" },
  coder:           { name: "Coder",      icon: Code,           color: "text-amber-400" },
  "code-reviewer": { name: "Reviewer",   icon: GitPullRequest, color: "text-pink-400" },
  "test-runner":   { name: "Tester",     icon: FlaskConical,   color: "text-sky-400" },
};

const TOOL_ICONS: Record<string, ElementType> = {
  Glob: Search, Grep: Search, Read: BookOpen, Edit: FileEdit,
  Write: FileEdit, Bash: Terminal, WebSearch: Globe, WebFetch: Globe,
};

function timeAgo(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

export function ActivityFeed() {
  const { activities, tabs } = useAgentStore();

  // Group activities by agentType
  const grouped = new Map<string, ActivityEvent[]>();
  for (const act of activities) {
    const list = grouped.get(act.agentType) ?? [];
    list.push(act);
    grouped.set(act.agentType, list);
  }

  const activeAgentCount = tabs.filter((t) => t.status === "streaming").length;

  return (
    <div className="flex h-full flex-col border-l border-cy-border bg-cy-bg/60 backdrop-blur-sm">
      <div className="flex items-center gap-2 border-b border-cy-border px-3 py-2">
        <svg className="h-3.5 w-3.5 text-cy-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
        </svg>
        <span className="text-xs font-medium text-cy-text">Activity</span>
        {activeAgentCount > 0 && (
          <span className="rounded-full bg-cy-accent/20 px-1.5 py-0.5 text-[9px] text-cy-accent">
            {activeAgentCount} active
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {activities.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <span className="text-[11px] text-cy-muted">No activity yet</span>
          </div>
        ) : (
          Array.from(grouped.entries()).map(([agentType, events]) => {
            const ui = AGENT_UI[agentType] ?? { name: agentType, icon: File, color: "text-cy-muted" };
            const AgentIcon = ui.icon;
            const tab = tabs.find((t) => t.agentType === agentType);
            return (
              <div key={agentType} className="mb-3">
                <div className="mb-1.5 flex items-center gap-1.5">
                  <AgentIcon className="h-3.5 w-3.5" style={{}} />
                  <span className="text-[11px] font-medium text-cy-text">{ui.name}</span>
                  {tab && (
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        tab.status === "streaming" ? "bg-blue-400 animate-pulse" : "bg-emerald-400"
                      }`}
                    />
                  )}
                </div>
                <div className="ml-2 border-l border-white/5 pl-2.5">
                  {events.slice(0, 20).map((event) => {
                    const ToolIcon = TOOL_ICONS[event.toolName] ?? File;
                    return (
                      <div
                        key={event.id}
                        className="group mb-1 flex items-start gap-1.5 rounded px-1 py-0.5 transition-colors hover:bg-cy-input/20"
                      >
                        <ToolIcon className="mt-0.5 h-3 w-3 shrink-0 text-cy-muted" strokeWidth={1.8} />
                        <div className="min-w-0 flex-1">
                          <span className="text-[10px] text-cy-muted">{event.toolName}</span>
                          {event.toolInput && (
                            <span className="ml-1 truncate text-[10px] text-cy-text/70">
                              {event.toolInput.slice(0, 60)}
                            </span>
                          )}
                        </div>
                        <span className="shrink-0 text-[9px] text-cy-muted/50">
                          {timeAgo(event.timestamp)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="border-t border-cy-border px-3 py-1.5">
        <div className="flex items-center justify-between text-[9px] text-cy-muted">
          <span>{activities.length} tool calls</span>
          <span>{activeAgentCount} agents active</span>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add dashboard/src/components/chat/activity-feed.tsx
git commit -m "feat(agent): connect ActivityFeed to real agent-store data"
```

---

## Task 12: Connect UI — ChatPanel + MessageList

**Files:**
- Modify: `dashboard/src/components/chat/chat-panel.tsx`
- Modify: `dashboard/src/components/chat/message-list.tsx`

**Note:** Must implement together with Task 10 (AgentTabs props removal).

- [ ] **Step 1: Update MessageList to accept props**

Modify `dashboard/src/components/chat/message-list.tsx` to accept optional `messages` and `isStreaming` props with fallback to chat-store:

```typescript
"use client";

import { useEffect, useRef } from "react";
import { useChatStore } from "@/stores/chat-store";
import type { ChatMessage } from "@/types/chat";
import { MessageBubble } from "./message-bubble";
import { ScrollArea } from "@/components/ui/scroll-area";

interface MessageListProps {
  messages?: ChatMessage[];
  isStreaming?: boolean;
}

export function MessageList({ messages: propMessages, isStreaming: propStreaming }: MessageListProps) {
  const storeMessages = useChatStore((s) => s.messages);
  const storeStreaming = useChatStore((s) => s.isStreaming);
  const messages = propMessages ?? storeMessages;
  const isStreaming = propStreaming ?? storeStreaming;
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isStreaming]);

  return (
    <ScrollArea className="flex-1 px-1">
      <div className="flex flex-col gap-3 py-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-cy-muted text-sm">
            <div className="text-4xl mb-3">🌀</div>
            <p>Ask CycloneOS anything...</p>
          </div>
        )}
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
        {isStreaming && (
          <div className="px-3 text-cy-accent text-xs animate-pulse">
            ● Thinking...
          </div>
        )}
        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  );
}
```

- [ ] **Step 2: Update ChatPanel to use agent-store and combined dispatch+SSE**

Replace `dashboard/src/components/chat/chat-panel.tsx`:

```typescript
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAgentStore } from "@/stores/agent-store";
import type { ChatMessage } from "@/types/chat";
import { MessageList } from "./message-list";
import { InputBar } from "./input-bar";
import { AgentTabs } from "./agent-tabs";
import { ActivityFeed } from "./activity-feed";

export function ChatPanel() {
  const {
    tabs, activeTabId, isActivityOpen, messagesByTab,
    addMessage: addAgentMessage, appendToLastAssistant: appendAgentText,
    setTabStatus, setTabProcessId, setTabSessionId, addActivity,
  } = useAgentStore();

  const [claudeOk, setClaudeOk] = useState(true);
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null);

  const activeTab = tabs.find((t) => t.id === activeTabId);
  const isStreaming = activeTab?.status === "streaming";

  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then((d) => setClaudeOk(d.claude))
      .catch(() => setClaudeOk(false));
  }, []);

  const handleStop = useCallback(() => {
    const tab = useAgentStore.getState().tabs.find(
      (t) => t.id === useAgentStore.getState().activeTabId
    );
    if (tab?.processId) {
      fetch("/api/agents/stop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ processId: tab.processId }),
      }).catch(() => {});
    }

    if (readerRef.current) {
      readerRef.current.cancel().catch(() => {});
      readerRef.current = null;
    }
    const tabId = useAgentStore.getState().activeTabId;
    appendAgentText(tabId, "\n\n_(interrupted)_");
    setTabStatus(tabId, "idle");
    setTabProcessId(tabId, null);
  }, [appendAgentText, setTabStatus, setTabProcessId]);

  const handleSend = useCallback(
    async (text: string) => {
      const tabId = useAgentStore.getState().activeTabId;
      const tab = useAgentStore.getState().tabs.find((t) => t.id === tabId);
      if (!tab) return;

      // Add user message
      const userMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: text,
        timestamp: Date.now(),
      };
      addAgentMessage(tabId, userMsg);

      // Add empty assistant message
      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "",
        timestamp: Date.now(),
      };
      addAgentMessage(tabId, assistantMsg);
      setTabStatus(tabId, "streaming");

      try {
        // Combined dispatch + SSE stream (single POST, no race condition)
        const res = await fetch("/api/agents/dispatch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            agentType: tab.agentType,
            prompt: text,
            sessionId: tab.sessionId,
          }),
        });

        if (!res.ok || !res.body) {
          appendAgentText(tabId, `Error: ${res.status} ${res.statusText}`);
          setTabStatus(tabId, "error");
          return;
        }

        const reader = res.body.getReader();
        readerRef.current = reader;
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const data = line.slice(6);
            if (data === "[DONE]") break;

            try {
              const event = JSON.parse(data);
              switch (event.type) {
                case "process":
                  // First event: processId for stop functionality
                  setTabProcessId(tabId, event.processId);
                  break;
                case "text":
                  appendAgentText(tabId, event.content);
                  break;
                case "tool_use":
                  addActivity({
                    id: crypto.randomUUID(),
                    processId: event.processId ?? "",
                    agentType: tab.agentType,
                    toolName: event.toolName,
                    toolInput: event.toolInput,
                    timestamp: event.timestamp,
                  });
                  break;
                case "session":
                  if (event.sessionId) {
                    setTabSessionId(tabId, event.sessionId);
                  }
                  break;
                case "error":
                  appendAgentText(tabId, `\n\nError: ${event.content}`);
                  break;
              }
            } catch {
              // Not JSON, skip
            }
          }
        }
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          appendAgentText(tabId, `\n\nConnection error: ${String(err)}`);
        }
      } finally {
        readerRef.current = null;
        setTabStatus(tabId, "idle");
        setTabProcessId(tabId, null);
      }
    },
    [addAgentMessage, appendAgentText, setTabStatus, setTabProcessId, setTabSessionId, addActivity]
  );

  const messages = messagesByTab[activeTabId] ?? [];

  return (
    <div className="flex h-full">
      <div className="flex min-w-0 flex-1 flex-col bg-cy-card/60 backdrop-blur-sm">
        <AgentTabs />
        {!claudeOk && (
          <div className="border-b border-cy-border bg-red-500/5 px-3 py-1">
            <span className="text-[11px] text-red-400">● Claude CLI unavailable</span>
          </div>
        )}
        <MessageList messages={messages} isStreaming={isStreaming} />
        <InputBar
          onSend={handleSend}
          onStop={handleStop}
          isStreaming={isStreaming}
        />
      </div>

      {isActivityOpen && (
        <div className="w-52 shrink-0">
          <ActivityFeed />
        </div>
      )}
    </div>
  );
}
```

**Note on InputBar:** `InputBar` currently reads `enterToSend` from `useChatStore`. This still works since both stores initialize `enterToSend: true`. Full migration of InputBar to agent-store happens in Phase 3.

- [ ] **Step 3: Verify build**

```bash
cd dashboard && npm run build
```

- [ ] **Step 4: Commit**

```bash
git add dashboard/src/components/chat/chat-panel.tsx dashboard/src/components/chat/message-list.tsx
git commit -m "feat(agent): connect ChatPanel to agent dispatch API with combined SSE streaming"
```

---

## Task 13: Integration Test — Manual Smoke Test

- [ ] **Step 1: Start dev server**

```bash
cd dashboard && npm run dev
```

- [ ] **Step 2: Test basic flow**

Open `http://localhost:3000` in browser:
1. Verify Chat Panel shows Agent Tabs with "General" tab
2. Click `+` to open Agent Picker → select "Researcher"
3. Type a message → verify dispatch goes to `/api/agents/dispatch`
4. Verify SSE stream shows text appearing in chat
5. Verify Activity Feed shows tool_use events (if any)
6. Verify tab status indicator changes (idle → streaming → idle)

- [ ] **Step 3: Test multi-agent**

1. Open another tab (e.g., "Coder")
2. Send messages to both tabs
3. Switch between tabs → messages should be per-tab
4. Verify Activity Feed shows events from all agents

- [ ] **Step 4: Test stop**

1. While agent is streaming, click stop button
2. Verify stream stops, tab returns to idle

- [ ] **Step 5: Test session persistence**

1. Check `dashboard/.data/sessions.db` exists after first dispatch
2. Visit `/api/agents/sessions` → should return session list

- [ ] **Step 6: Commit any fixes from smoke test**

```bash
git add -A && git commit -m "fix(agent): smoke test fixes for Phase 1 integration"
```

---

## Summary

| Task | Description | Files | Depends On |
|------|-------------|-------|------------|
| 1 | Dependencies & Config | 3 | — |
| 2 | Types & Agent Definitions | 4 | — |
| 3 | Extend claude-bridge | 1 | Task 2 |
| 4 | EventBus | 1 | Task 2 |
| 5 | Executor + LocalExecutor | 2 | Tasks 3, 4 |
| 6 | SessionStore (SQLite) | 1 | Task 1 |
| 7 | AgentManager | 1 | Tasks 4, 5, 6 |
| 8 | API Routes | 3 | Task 7 |
| 9 | Agent Store (Zustand) | 1 | Task 2 |
| 10 | Connect AgentTabs | 1 | Task 9 |
| 11 | Connect ActivityFeed | 1 | Task 9 |
| 12 | Connect ChatPanel + MessageList | 2 | Tasks 8, 9, 10 |
| 13 | Integration Smoke Test | — | All |

**Review fixes incorporated:**
- ✅ Queue logic: synchronous return with "queued" status
- ✅ Listener leak: named handler reference for proper cleanup
- ✅ Race condition: combined dispatch+SSE endpoint
- ✅ Error-exit: preserve error status when done fires after error
- ✅ ClaudeModel: single definition in types/chat.ts
- ✅ HMR safety: globalThis pattern for all singletons
- ✅ MessageList: explicit code change with props
- ✅ EventBus maxListeners: raised to 50
- ✅ DATA_DIR: absolute path instead of process.cwd()
- ✅ allowedTools: noted in interface, deferred to Phase 2
