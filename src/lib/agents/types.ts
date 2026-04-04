import type { PermissionMode, ClaudeModel, AgentCliProvider, AgentModel } from "@/types/chat";

export type AgentStatus = "idle" | "streaming" | "queued" | "error";

export interface AgentDefinition {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  systemPrompt: string;
  model: ClaudeModel;
  permissionMode: PermissionMode;
  allowedTools?: string[];
  contextDirs?: string[];
}

export interface SpawnOptions {
  agentType: string;
  prompt: string;
  sessionId?: string | null;
  model?: AgentModel;
  permissionMode?: PermissionMode;
  provider?: AgentCliProvider;
  systemPrompt?: string;
  contextDirs?: string[];
}

export interface AgentProcess {
  id: string;
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
