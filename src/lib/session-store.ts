import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const DATA_DIR = path.join(process.cwd(), ".data");
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
