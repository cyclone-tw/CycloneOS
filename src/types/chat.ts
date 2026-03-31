export type MessageRole = "user" | "assistant";

export interface FileAttachment {
  name: string;
  mimeType: string;
  size: number;
  /** For images only — object URL for preview thumbnail */
  previewUrl?: string;
  /** Server-side temp path after upload */
  tempPath?: string;
}

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: number;
  files?: FileAttachment[];
}

export type PermissionMode = "acceptEdits" | "bypassPermissions" | "default";

export interface SessionInfo {
  id: string;
  title: string;
  createdAt: number;
}

/** One line of claude --output-format stream-json --verbose */
export interface ClaudeStreamEvent {
  type: string;
  subtype?: string;
  message?: {
    role: string;
    content: Array<{
      type: string;
      text?: string;
    }>;
  };
  [key: string]: unknown;
}

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
