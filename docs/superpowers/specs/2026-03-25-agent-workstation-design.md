# CycloneOS Agent Workstation — Design Spec

**Date:** 2026-03-25
**Status:** Draft
**Author:** Claude + Cyclone

## 1. Overview

升級 Dashboard Chat Panel 為完整的 Agent Workstation，支援：
- 多 Agent 並行 dispatch（最多 4 個同時執行）
- 6 種預定義 Agent 角色（可擴展）
- 側邊 Activity Feed 即時追蹤 tool call
- SQLite session 歷史持久化
- 預留遠端執行擴展介面

## 2. Architecture

```
┌─────────────────────────────────────────────┐
│                  Dashboard UI                │
│  ┌──────────┐ ┌──────────┐ ┌──────────────┐ │
│  │ Chat     │ │ Agent    │ │ Activity     │ │
│  │ Panel    │ │ Tabs     │ │ Feed (側邊)  │ │
│  └────┬─────┘ └────┬─────┘ └──────┬───────┘ │
│       │            │               │         │
│  ┌────▼────────────▼───────────────▼───────┐ │
│  │          Agent Store (Zustand)          │ │
│  │  agents[] / sessions[] / activities[]   │ │
│  └────────────────┬────────────────────────┘ │
└───────────────────┼──────────────────────────┘
                    │ SSE streams
┌───────────────────▼──────────────────────────┐
│              API Routes (Next.js)            │
│  POST /api/agents/dispatch  ← 啟動 agent    │
│  POST /api/agents/stop      ← 停止 agent    │
│  GET  /api/agents/stream/:id ← SSE 串流     │
│  GET  /api/agents/sessions   ← 歷史列表     │
│  GET  /api/agents/health     ← 狀態檢查     │
└───────────────────┬──────────────────────────┘
                    │
┌───────────────────▼──────────────────────────┐
│            AgentManager (核心)                │
│  ┌─────────────┐  ┌───────────────────────┐  │
│  │ AgentRegistry│  │ ProcessPool           │  │
│  │ (角色定義)   │  │ (max concurrent: 4)   │  │
│  └─────────────┘  └───────────────────────┘  │
│  ┌─────────────┐  ┌───────────────────────┐  │
│  │ EventBus    │  │ SessionStore (SQLite) │  │
│  │ (tool/text) │  │ (歷史 + 持久化)       │  │
│  └─────────────┘  └───────────────────────┘  │
└───────────────────┬──────────────────────────┘
                    │ spawn
┌───────────────────▼──────────────────────────┐
│          Executor Interface                  │
│  ┌──────────────┐  ┌─────────────────────┐   │
│  │ LocalExecutor│  │ RemoteExecutor (預留)│   │
│  │ claude -p    │  │ SSH / WebSocket     │   │
│  └──────────────┘  └─────────────────────┘   │
└──────────────────────────────────────────────┘
```

## 3. Agent Definitions

每個 Agent 是一個 TypeScript 物件，存在 `dashboard/src/lib/agents/definitions.ts`。

```typescript
interface AgentDefinition {
  id: string;
  name: string;
  description: string;
  icon: string;               // Lucide icon name
  color: string;              // Tailwind color class
  systemPrompt: string;
  allowedTools: string[];
  model: "sonnet" | "opus" | "haiku";
  permissionMode: "default" | "acceptEdits" | "bypassPermissions";
  contextDirs?: string[];     // 額外 --add-dir
  maxTurns?: number;
}
```

### 6 個初始 Agent

| 優先序 | ID | Name | Icon | Color | Model | Permission | 核心能力 |
|--------|-----|------|------|-------|-------|-----------|---------|
| 1 | `researcher` | Researcher | BookOpen | purple-400 | opus | default | 讀 Obsidian vault + web search，產出研究筆記 |
| 2 | `writer` | Writer | PenTool | emerald-400 | opus | default | 產出文件、文章、session log |
| 3 | `general` | General | MessageCircle | cy-accent | sonnet | default | 通用對話（現有 Chat 升級版） |
| 4 | `coder` | Coder | Code | amber-400 | sonnet | acceptEdits | 寫程式、改 code、建檔案 |
| 5 | `code-reviewer` | Reviewer | GitPullRequest | pink-400 | sonnet | default | 審查 git diff/PR，產出 review |
| 6 | `test-runner` | Tester | FlaskConical | sky-400 | sonnet | default | 跑測試、分析失敗 |

### Researcher systemPrompt（範例）

```
你是 CycloneOS 的研究助理。工作流程：
1. 根據使用者主題，搜尋 Obsidian vault 中的相關筆記
2. 如需外部資訊，使用 web search
3. 整合後產出結構化研究摘要
4. 格式：## 摘要 → ## 關鍵發現 → ## 來源列表

Obsidian vault 路徑已透過 --add-dir 提供。
優先搜尋 Draco/cron/ 和 Draco/research/ 目錄。
```

## 4. Core Components

### 4.1 AgentManager (`dashboard/src/lib/agent-manager.ts`)

Server-side singleton，管理所有 agent 的生命週期。

```typescript
class AgentManager {
  private registry: Map<string, AgentDefinition>;
  private pool: Map<string, AgentProcess>;     // running agents
  private eventBus: EventEmitter;
  private sessionStore: SessionStore;

  dispatch(agentType: string, prompt: string, sessionId?: string): string;  // returns agentProcessId
  stop(processId: string): void;
  getStream(processId: string): ReadableStream;
  listActive(): AgentProcess[];
  getHistory(limit?: number): SessionRecord[];
}
```

**ProcessPool 規則：**
- 最多 4 個 concurrent agents
- 超過 4 個時排隊（queue），前一個完成後自動啟動
- 每個 agent 有 120s inactivity timeout

### 4.2 Executor Interface (`dashboard/src/lib/executors/`)

```typescript
interface Executor {
  spawn(options: SpawnOptions): AgentProcess;
  kill(processId: string): void;
}

// v1: LocalExecutor
class LocalExecutor implements Executor {
  // 用 child_process.spawn 呼叫 claude -p
  // flags: --print --verbose --output-format stream-json
  //        --permission-mode {mode} --model {model}
  //        --append-system-prompt {agentSystemPrompt}
  //        --add-dir {vault} [--resume {sessionId}]
}

// 預留: RemoteExecutor
class RemoteExecutor implements Executor {
  // 未來透過 SSH 或 WebSocket 連到 Mac Mini
}
```

### 4.3 EventBus

統一收集所有 agent 的 stream events，分為：

| Event Type | 內容 | 用途 |
|-----------|------|------|
| `text` | assistant 文字片段 | Chat 對話顯示 |
| `tool_use` | tool name + input | Activity Feed |
| `tool_result` | tool output (truncated) | Activity Feed 展開 |
| `session` | session ID | Session resumption |
| `error` | error message | 錯誤顯示 |
| `done` | 完成信號 | 狀態更新 |

### 4.4 SessionStore (`dashboard/src/lib/session-store.ts`)

SQLite（用 `better-sqlite3`）存在 `dashboard/.data/sessions.db`。

```sql
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,           -- Claude session ID
  agent_type TEXT NOT NULL,
  title TEXT,                    -- 從第一則 user message 自動生成
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  message_count INTEGER DEFAULT 0
);

CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id),
  role TEXT NOT NULL,             -- 'user' | 'assistant'
  content TEXT NOT NULL,
  timestamp INTEGER NOT NULL
);

CREATE TABLE activities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL REFERENCES sessions(id),
  tool_name TEXT NOT NULL,
  tool_input TEXT,               -- JSON, truncated
  tool_output TEXT,              -- JSON, truncated
  timestamp INTEGER NOT NULL
);
```

## 5. API Routes

### POST /api/agents/dispatch
```json
{
  "agentType": "researcher",
  "prompt": "分析最新的 Claude Agent SDK 功能",
  "sessionId": null,
  "model": "opus",
  "permissionMode": "default"
}
// Response: { "processId": "abc123", "streamUrl": "/api/agents/stream/abc123" }
```

### POST /api/agents/stop
```json
{ "processId": "abc123" }
// Response: { "success": true }
```

### GET /api/agents/stream/:id
SSE stream，格式同現有 `/api/chat` 但增加 `tool_use` 和 `tool_result` events。

### GET /api/agents/sessions
```json
// Response:
{
  "sessions": [
    { "id": "s1", "agentType": "researcher", "title": "Claude SDK 研究", "createdAt": 1711234567, "messageCount": 12 },
    ...
  ]
}
```

## 6. UI Components

### 6.1 Agent Tabs（已建原型）
- 位置：Chat Panel 頂部
- 功能：多 tab 切換、狀態指示（🟢 idle / 🔵 streaming / 🔴 error）、關閉 tab
- 檔案：`dashboard/src/components/chat/agent-tabs.tsx`

### 6.2 Agent Picker（已建原型）
- 觸發：點 `+` 按鈕
- 顯示：3x2 grid，每個 agent 有 icon + 名稱
- 點選後建立新 tab 並 dispatch
- 檔案：整合在 `agent-tabs.tsx`

### 6.3 Activity Feed（已建原型）
- 位置：Chat Panel 右側，可收合
- 寬度：208px (w-52)
- 內容：按 agent 分組的 tool call 時間線
- 每行：tool icon + tool name + target (truncated) + time
- 可點開看完整 input/output
- 檔案：`dashboard/src/components/chat/activity-feed.tsx`

### 6.4 Session History Panel（待建）
- 觸發：點 History 按鈕（時鐘 icon）
- 顯示：overlay 列表，從 SQLite 讀取
- 每行：agent icon + title + 日期 + message count
- 點選後恢復對話（用 `--resume`）

### 6.5 升級後的 Input Bar
- 保留現有功能：Drive 拖拉、model selector、permission badge、enter-to-send
- 新增：當前 agent 名稱顯示在 input 左側（小標籤）

## 7. State Management

### Agent Store (`dashboard/src/stores/agent-store.ts`)

取代現有的 `chat-store.ts`，統一管理所有 agent 狀態。

```typescript
interface AgentStoreState {
  // Tab management
  tabs: AgentTab[];             // { id, agentType, status, sessionId }
  activeTabId: string;

  // Per-tab messages (in memory, backed by SQLite)
  messagesByTab: Record<string, ChatMessage[]>;

  // Activity feed
  activities: ActivityEvent[];   // 所有 agent 的 tool call events

  // Global
  isActivityOpen: boolean;
  isHistoryOpen: boolean;
}
```

## 8. Data Flow

### Dispatch 流程
```
User types in Chat → clicks send
    ↓
InputBar.onSend(text)
    ↓
ChatPanel reads activeTab → gets agentType
    ↓
POST /api/agents/dispatch { agentType, prompt, sessionId }
    ↓
AgentManager.dispatch()
    → AgentRegistry.get(agentType) → gets definition
    → ProcessPool.acquire() → checks capacity (max 4)
    → LocalExecutor.spawn() → claude -p with agent config
    → Returns processId + streamUrl
    ↓
Frontend opens SSE to /api/agents/stream/:id
    ↓
EventBus emits events → SSE pushes to client
    → "text" → appendToMessages(tabId, text)
    → "tool_use" → addActivity(agentId, toolName, input)
    → "session" → setSessionId(tabId, sessionId)
    → "done" → setTabStatus(tabId, "idle")
    ↓
SessionStore persists messages + activities to SQLite
```

### Drive → Agent 拖拉流程
```
User drags file from Drive → drops on Chat textarea
    ↓
InputBar.handleDrop() → parses metadata
    → inserts "請讀取以下檔案：\n{path}" into textarea
    ↓
User clicks send → dispatches to current active agent
    → Researcher: "分析這份文件的重點"
    → Writer: "根據這份資料寫摘要"
    → Coder: "讀取並修改這個檔案"
```

## 9. File Structure

```
dashboard/src/
├── lib/
│   ├── agents/
│   │   ├── definitions.ts        ← 6 agent 定義
│   │   └── types.ts              ← AgentDefinition interface
│   ├── agent-manager.ts          ← AgentManager singleton
│   ├── executors/
│   │   ├── executor.ts           ← Executor interface
│   │   ├── local-executor.ts     ← CLI spawn 實作
│   │   └── remote-executor.ts    ← 預留（空實作）
│   ├── event-bus.ts              ← EventEmitter wrapper
│   ├── session-store.ts          ← SQLite CRUD
│   └── claude-bridge.ts          ← 保留，被 LocalExecutor 引用
├── stores/
│   └── agent-store.ts            ← 取代 chat-store.ts
├── components/chat/
│   ├── chat-panel.tsx            ← 升級：整合 AgentTabs + ActivityFeed
│   ├── agent-tabs.tsx            ← ✅ 已建原型
│   ├── activity-feed.tsx         ← ✅ 已建原型
│   ├── session-history.tsx       ← 新增
│   ├── input-bar.tsx             ← 小改：顯示 agent 標籤
│   ├── message-list.tsx          ← 不變
│   ├── message-bubble.tsx        ← 不變
│   ├── model-selector.tsx        ← 不變
│   └── permission-badge.tsx      ← 不變
├── app/api/
│   ├── agents/
│   │   ├── dispatch/route.ts     ← 新增
│   │   ├── stop/route.ts         ← 新增
│   │   ├── stream/[id]/route.ts  ← 新增
│   │   └── sessions/route.ts     ← 新增
│   ├── chat/route.ts             ← 保留（向後相容）
│   └── health/route.ts           ← 不變
└── types/
    └── chat.ts                   ← 擴展 agent 相關 types
```

## 10. Implementation Priority

按 Agent 優先順序分批實作：

### Phase 1: 基礎設施（所有 agent 共用）
- AgentManager + ProcessPool + EventBus
- Executor interface + LocalExecutor
- SessionStore (SQLite)
- Agent Store (Zustand)
- API routes (dispatch / stop / stream / sessions)
- UI: Agent Tabs 功能化（連接真實 dispatch）
- UI: Activity Feed 功能化（連接真實 events）

### Phase 2: Researcher + Writer
- Researcher agent 定義 + systemPrompt
- Writer agent 定義 + systemPrompt
- 測試 vault 搜尋 + 文件產出

### Phase 3: General + Coder
- General agent（遷移現有 Chat 邏輯）
- Coder agent（acceptEdits 模式）
- 向後相容：舊 /api/chat route 繼續工作

### Phase 4: Code Reviewer + Test Runner
- Code Reviewer agent
- Test Runner agent
- Session History UI

### Phase 5: 打磨
- Markdown rendering in messages
- Session search
- Agent 自訂（使用者自建角色）
- Remote Executor adapter（Mac Mini）

## 11. Dependencies

```json
{
  "better-sqlite3": "^11.0.0",
  "@types/better-sqlite3": "^7.6.0"
}
```

其餘均為現有依賴（react, zustand, lucide-react, next.js）。

## 12. Migration

- `chat-store.ts` → `agent-store.ts`（漸進式，保留舊 store 到 Phase 3 完成）
- `/api/chat` route 保留，Phase 3 完成後改為 proxy 到 `/api/agents/dispatch`
- 現有 Chat 功能在整個遷移過程中持續可用

## 13. Constraints

- 最多 4 個 concurrent agent processes（避免 CPU/memory 過載）
- SQLite 檔案 `.data/sessions.db` 加入 `.gitignore`
- Agent systemPrompt 不超過 500 tokens
- Activity Feed 最多保留最近 200 筆 events（記憶體）
- Session history 最多顯示最近 100 筆（UI），SQLite 不限

## 14. Success Criteria

- [ ] 可以從 Dashboard 同時 dispatch 2+ agents 並看到各自的串流回應
- [ ] Activity Feed 即時顯示每個 agent 的 tool call
- [ ] 關閉瀏覽器後重開，能從 Session History 恢復對話
- [ ] Drive 拖拉到任意 agent 的 Chat 都能正常工作
- [ ] Researcher agent 能搜尋 Obsidian vault 並產出結構化筆記
- [ ] 現有 Chat 功能不受影響（向後相容）
